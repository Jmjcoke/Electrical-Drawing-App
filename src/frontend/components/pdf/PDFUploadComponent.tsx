import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, AlertCircle, CheckCircle, X, Eye } from 'lucide-react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Progress } from '../ui/Progress';
import { Alert, AlertDescription } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { usePDFStore } from '../../stores/pdfStore';
import { cn } from '../../lib/utils';

interface PDFUploadComponentProps {
  projectId: string;
  onUploadComplete?: (drawingId: string) => void;
  onUploadStart?: () => void;
  maxFiles?: number;
  className?: string;
}

interface UploadFile extends File {
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
  drawingId?: string;
}

export const PDFUploadComponent: React.FC<PDFUploadComponentProps> = ({
  projectId,
  onUploadComplete,
  onUploadStart,
  maxFiles = 10,
  className
}) => {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  
  const { uploadPDF, getProcessingStatus } = usePDFStore();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Filter for PDF files only
    const pdfFiles = acceptedFiles.filter(file => 
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );

    if (pdfFiles.length === 0) {
      alert('Please select only PDF files.');
      return;
    }

    // Check file size limits (100MB per file)
    const oversizedFiles = pdfFiles.filter(file => file.size > 100 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      alert(`Some files exceed the 100MB limit: ${oversizedFiles.map(f => f.name).join(', ')}`);
      return;
    }

    // Check total number of files
    if (uploadFiles.length + pdfFiles.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed. Please remove some files first.`);
      return;
    }

    // Add files to upload queue
    const newUploadFiles: UploadFile[] = pdfFiles.map(file => ({
      ...file,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      progress: 0,
      status: 'pending'
    }));

    setUploadFiles(prev => [...prev, ...newUploadFiles]);
  }, [uploadFiles.length, maxFiles]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: maxFiles - uploadFiles.length,
    disabled: isUploading
  });

  const removeFile = (fileId: string) => {
    setUploadFiles(prev => prev.filter(file => file.id !== fileId));
  };

  const uploadAllFiles = async () => {
    const pendingFiles = uploadFiles.filter(file => file.status === 'pending');
    
    if (pendingFiles.length === 0) {
      return;
    }

    setIsUploading(true);
    onUploadStart?.();

    for (const file of pendingFiles) {
      try {
        // Update status to uploading
        setUploadFiles(prev =>
          prev.map(f => f.id === file.id ? { ...f, status: 'uploading' as const } : f)
        );

        // Simulate upload progress
        let progress = 0;
        const progressInterval = setInterval(() => {
          progress += Math.random() * 20;
          if (progress > 90) {
            clearInterval(progressInterval);
            progress = 90;
          }
          
          setUploadFiles(prev =>
            prev.map(f => f.id === file.id ? { ...f, progress } : f)
          );
        }, 500);

        // Upload file
        const result = await uploadPDF(projectId, file);
        
        clearInterval(progressInterval);

        if (result.success) {
          // Update to processing status
          setUploadFiles(prev =>
            prev.map(f => f.id === file.id ? {
              ...f,
              status: 'processing' as const,
              progress: 100,
              drawingId: result.data.id
            } : f)
          );

          // Monitor processing status
          monitorProcessingStatus(file.id, result.data.id);
        } else {
          // Update to error status
          setUploadFiles(prev =>
            prev.map(f => f.id === file.id ? {
              ...f,
              status: 'error' as const,
              progress: 0,
              error: result.error || 'Upload failed'
            } : f)
          );
        }
      } catch (error) {
        setUploadFiles(prev =>
          prev.map(f => f.id === file.id ? {
            ...f,
            status: 'error' as const,
            progress: 0,
            error: error instanceof Error ? error.message : 'Upload failed'
          } : f)
        );
      }
    }

    setIsUploading(false);
  };

  const monitorProcessingStatus = async (fileId: string, drawingId: string) => {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes with 5-second intervals

    const checkStatus = async () => {
      try {
        const statusResult = await getProcessingStatus(drawingId);
        
        if (statusResult.success) {
          const { status, progress_percentage, error_message } = statusResult.data;
          
          if (status === 'ANALYZED') {
            // Processing completed successfully
            setUploadFiles(prev =>
              prev.map(f => f.id === fileId ? {
                ...f,
                status: 'completed' as const,
                progress: 100
              } : f)
            );
            onUploadComplete?.(drawingId);
            return;
          } else if (status === 'FAILED') {
            // Processing failed
            setUploadFiles(prev =>
              prev.map(f => f.id === fileId ? {
                ...f,
                status: 'error' as const,
                error: error_message || 'Processing failed'
              } : f)
            );
            return;
          } else {
            // Still processing
            setUploadFiles(prev =>
              prev.map(f => f.id === fileId ? {
                ...f,
                progress: Math.max(90, progress_percentage || 90)
              } : f)
            );
          }
        }

        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 5000); // Check again in 5 seconds
        } else {
          // Timeout
          setUploadFiles(prev =>
            prev.map(f => f.id === fileId ? {
              ...f,
              status: 'error' as const,
              error: 'Processing timeout'
            } : f)
          );
        }
      } catch (error) {
        console.error('Error checking processing status:', error);
        attempts++;
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 5000);
        }
      }
    };

    // Start monitoring
    setTimeout(checkStatus, 2000); // Initial delay
  };

  const getStatusColor = (status: UploadFile['status']) => {
    switch (status) {
      case 'pending': return 'text-gray-500';
      case 'uploading': return 'text-blue-500';
      case 'processing': return 'text-yellow-500';
      case 'completed': return 'text-green-500';
      case 'error': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'pending': return <Upload className="h-4 w-4" />;
      case 'uploading': return <Upload className="h-4 w-4 animate-pulse" />;
      case 'processing': return <Eye className="h-4 w-4 animate-pulse" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'error': return <AlertCircle className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const hasPendingFiles = uploadFiles.some(file => file.status === 'pending');
  const hasActiveUploads = uploadFiles.some(file => 
    file.status === 'uploading' || file.status === 'processing'
  );

  return (
    <div className={cn('space-y-6', className)}>
      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Electrical Drawings</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              isDragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 hover:border-gray-400',
              isUploading && 'pointer-events-none opacity-50'
            )}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            
            {isDragActive ? (
              <p className="text-blue-600 font-medium">Drop the PDF files here...</p>
            ) : (
              <div className="space-y-2">
                <p className="text-gray-600 font-medium">
                  Drag & drop PDF files here, or click to select
                </p>
                <p className="text-sm text-gray-500">
                  Maximum {maxFiles} files, up to 100MB each
                </p>
              </div>
            )}
          </div>

          {uploadFiles.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium">
                  Files ({uploadFiles.length}/{maxFiles})
                </h3>
                {hasPendingFiles && (
                  <Button
                    onClick={uploadAllFiles}
                    disabled={isUploading}
                    size="sm"
                  >
                    {isUploading ? 'Uploading...' : `Upload ${uploadFiles.filter(f => f.status === 'pending').length} Files`}
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                {uploadFiles.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center space-x-3 p-3 border rounded-lg"
                  >
                    <div className={cn('flex-shrink-0', getStatusColor(file.status))}>
                      {getStatusIcon(file.status)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium truncate">
                          {file.name}
                        </p>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">
                            {formatFileSize(file.size)}
                          </Badge>
                          {file.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(file.id)}
                              className="h-6 w-6 p-0"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>

                      {(file.status === 'uploading' || file.status === 'processing') && (
                        <div className="mt-1">
                          <Progress value={file.progress} className="h-1" />
                          <p className="text-xs text-gray-500 mt-1">
                            {file.status === 'uploading' ? 'Uploading...' : 'Processing...'}
                          </p>
                        </div>
                      )}

                      {file.status === 'completed' && (
                        <p className="text-xs text-green-600 mt-1">
                          Upload and processing completed successfully
                        </p>
                      )}

                      {file.status === 'error' && file.error && (
                        <Alert variant="destructive" className="mt-2">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            {file.error}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Status Information */}
      {hasActiveUploads && (
        <Alert>
          <Eye className="h-4 w-4" />
          <AlertDescription>
            Files are being processed. This may take a few minutes depending on file size and complexity.
            You can continue working while processing completes in the background.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};