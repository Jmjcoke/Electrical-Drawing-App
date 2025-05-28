// Training Data Uploader Component - Story 3.6

'use client';

import React, { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { useTrainingDataStore } from '@/stores/trainingDataStore';
import { SupportedFileType, DatasetCategory, ElectricalStandard, ProjectType } from '@/types/ai/trainingData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Progress } from '@/components/ui/Progress';
import { 
  Upload, 
  File, 
  X, 
  CheckCircle, 
  AlertTriangle,
  Folder,
  Image,
  FileText,
  Zap,
  Settings
} from 'lucide-react';

interface TrainingDataUploaderProps {
  datasetId?: string;
  allowedFileTypes?: SupportedFileType[];
  maxFileSize?: number; // in bytes
  maxFiles?: number;
  onUploadComplete?: (result: any) => void;
  className?: string;
}

interface FilePreview {
  file: File;
  id: string;
  preview?: string;
  error?: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
}

const defaultAllowedTypes: SupportedFileType[] = [
  SupportedFileType.PDF,
  SupportedFileType.PNG,
  SupportedFileType.JPG,
  SupportedFileType.JPEG,
  SupportedFileType.SVG
];

const fileTypeIcons = {
  [SupportedFileType.PDF]: FileText,
  [SupportedFileType.PNG]: Image,
  [SupportedFileType.JPG]: Image,
  [SupportedFileType.JPEG]: Image,
  [SupportedFileType.SVG]: Image,
  [SupportedFileType.DWG]: FileText,
  [SupportedFileType.DXF]: FileText,
  [SupportedFileType.TIFF]: Image
};

export const TrainingDataUploader: React.FC<TrainingDataUploaderProps> = ({
  datasetId,
  allowedFileTypes = defaultAllowedTypes,
  maxFileSize = 50 * 1024 * 1024, // 50MB default
  maxFiles = 50,
  onUploadComplete,
  className
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  
  const { 
    uploadFiles, 
    isUploading, 
    uploadProgress,
    createDataset,
    datasets 
  } = useTrainingDataStore();

  const [selectedFiles, setSelectedFiles] = useState<FilePreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [showDatasetSelector, setShowDatasetSelector] = useState(!datasetId);
  const [selectedDatasetId, setSelectedDatasetId] = useState(datasetId || '');
  const [newDatasetConfig, setNewDatasetConfig] = useState({
    name: '',
    description: '',
    category: DatasetCategory.COMPONENTS,
    electricalStandard: ElectricalStandard.NEC,
    projectType: ProjectType.COMMERCIAL,
    tags: ''
  });

  // File validation
  const validateFile = useCallback((file: File): string | null => {
    // Check file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const isValidType = allowedFileTypes.some(type => 
      type === fileExtension || 
      (type === SupportedFileType.JPEG && fileExtension === 'jpg')
    );
    
    if (!isValidType) {
      return `File type .${fileExtension} is not supported. Allowed types: ${allowedFileTypes.join(', ')}`;
    }

    // Check file size
    if (file.size > maxFileSize) {
      return `File size (${Math.round(file.size / 1024 / 1024)}MB) exceeds maximum allowed size (${Math.round(maxFileSize / 1024 / 1024)}MB)`;
    }

    return null;
  }, [allowedFileTypes, maxFileSize]);

  // Process selected files
  const processFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    
    if (selectedFiles.length + fileArray.length > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed. Please remove some files first.`);
      return;
    }

    const newPreviews: FilePreview[] = fileArray.map(file => {
      const id = `${file.name}-${Date.now()}-${Math.random()}`;
      const error = validateFile(file);
      
      const preview: FilePreview = {
        file,
        id,
        error: error || undefined,
        status: error ? 'error' : 'pending'
      };

      // Generate preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setSelectedFiles(prev => 
            prev.map(p => p.id === id ? { ...p, preview: e.target?.result as string } : p)
          );
        };
        reader.readAsDataURL(file);
      }

      return preview;
    });

    setSelectedFiles(prev => [...prev, ...newPreviews]);
  }, [selectedFiles, maxFiles, validateFile]);

  // File input handler
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  }, [processFiles]);

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  // Remove file
  const removeFile = useCallback((id: string) => {
    setSelectedFiles(prev => prev.filter(file => file.id !== id));
  }, []);

  // Clear all files
  const clearAllFiles = useCallback(() => {
    setSelectedFiles([]);
  }, []);

  // Create new dataset
  const handleCreateDataset = useCallback(async () => {
    try {
      const tags = newDatasetConfig.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      
      const dataset = await createDataset({
        name: newDatasetConfig.name,
        description: newDatasetConfig.description,
        category: newDatasetConfig.category,
        electricalStandard: newDatasetConfig.electricalStandard,
        projectType: newDatasetConfig.projectType,
        tags,
        status: 'draft'
      });

      setSelectedDatasetId(dataset.id);
      setShowDatasetSelector(false);
    } catch (error) {
      console.error('Failed to create dataset:', error);
      alert('Failed to create dataset. Please try again.');
    }
  }, [newDatasetConfig, createDataset]);

  // Upload files
  const handleUpload = useCallback(async () => {
    if (!selectedDatasetId) {
      alert('Please select a dataset first.');
      return;
    }

    const validFiles = selectedFiles
      .filter(filePreview => !filePreview.error)
      .map(filePreview => filePreview.file);

    if (validFiles.length === 0) {
      alert('No valid files to upload.');
      return;
    }

    try {
      // Update file statuses to uploading
      setSelectedFiles(prev => 
        prev.map(file => ({ ...file, status: file.error ? 'error' : 'uploading' }))
      );

      const result = await uploadFiles(selectedDatasetId, validFiles);
      
      // Update file statuses based on results
      setSelectedFiles(prev => 
        prev.map(file => ({
          ...file,
          status: result.successful.includes(file.file.name) ? 'success' : 
                 result.failed.some(f => f.fileName === file.file.name) ? 'error' : file.status
        }))
      );

      onUploadComplete?.(result);

      // Clear successful files after a delay
      setTimeout(() => {
        setSelectedFiles(prev => prev.filter(file => file.status !== 'success'));
      }, 2000);

    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
      
      // Reset file statuses
      setSelectedFiles(prev => 
        prev.map(file => ({ ...file, status: file.error ? 'error' : 'pending' }))
      );
    }
  }, [selectedDatasetId, selectedFiles, uploadFiles, onUploadComplete]);

  const getFileIcon = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    const IconComponent = fileTypeIcons[extension as SupportedFileType] || File;
    return IconComponent;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'uploading':
        return <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />;
      default:
        return null;
    }
  };

  const validFileCount = selectedFiles.filter(f => !f.error).length;
  const errorFileCount = selectedFiles.filter(f => f.error).length;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Upload className="h-5 w-5 text-blue-600" />
          <span>Training Data Upload</span>
          {selectedFiles.length > 0 && (
            <Badge variant="secondary">
              {validFileCount} files {errorFileCount > 0 && `(${errorFileCount} errors)`}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Dataset Selection */}
        {showDatasetSelector && (
          <div className="space-y-4">
            <h4 className="font-semibold">Select or Create Dataset</h4>
            
            {/* Existing Datasets */}
            {datasets.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-2 block">Existing Datasets</label>
                <select
                  value={selectedDatasetId}
                  onChange={(e) => setSelectedDatasetId(e.target.value)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="">Select a dataset...</option>
                  {datasets.map(dataset => (
                    <option key={dataset.id} value={dataset.id}>
                      {dataset.name} ({dataset.category} - {dataset.electricalStandard})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Create New Dataset */}
            <div className="border-t pt-4">
              <h5 className="font-medium mb-3">Or Create New Dataset</h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Name</label>
                  <input
                    type="text"
                    value={newDatasetConfig.name}
                    onChange={(e) => setNewDatasetConfig(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full p-2 border rounded-md"
                    placeholder="Dataset name..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Category</label>
                  <select
                    value={newDatasetConfig.category}
                    onChange={(e) => setNewDatasetConfig(prev => ({ ...prev, category: e.target.value as DatasetCategory }))}
                    className="w-full p-2 border rounded-md"
                  >
                    {Object.values(DatasetCategory).map(category => (
                      <option key={category} value={category}>
                        {category.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Standard</label>
                  <select
                    value={newDatasetConfig.electricalStandard}
                    onChange={(e) => setNewDatasetConfig(prev => ({ ...prev, electricalStandard: e.target.value as ElectricalStandard }))}
                    className="w-full p-2 border rounded-md"
                  >
                    {Object.values(ElectricalStandard).map(standard => (
                      <option key={standard} value={standard}>
                        {standard.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Project Type</label>
                  <select
                    value={newDatasetConfig.projectType}
                    onChange={(e) => setNewDatasetConfig(prev => ({ ...prev, projectType: e.target.value as ProjectType }))}
                    className="w-full p-2 border rounded-md"
                  >
                    {Object.values(ProjectType).map(type => (
                      <option key={type} value={type}>
                        {type.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4">
                <label className="text-sm font-medium mb-1 block">Description</label>
                <textarea
                  value={newDatasetConfig.description}
                  onChange={(e) => setNewDatasetConfig(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full p-2 border rounded-md"
                  rows={2}
                  placeholder="Dataset description..."
                />
              </div>
              <div className="mt-4">
                <label className="text-sm font-medium mb-1 block">Tags (comma separated)</label>
                <input
                  type="text"
                  value={newDatasetConfig.tags}
                  onChange={(e) => setNewDatasetConfig(prev => ({ ...prev, tags: e.target.value }))}
                  className="w-full p-2 border rounded-md"
                  placeholder="symbols, industrial, custom..."
                />
              </div>
              <Button
                onClick={handleCreateDataset}
                className="mt-3"
                disabled={!newDatasetConfig.name}
              >
                Create Dataset
              </Button>
            </div>
          </div>
        )}

        {/* File Drop Zone */}
        {selectedDatasetId && (
          <div>
            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
                isDragging 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              )}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Drop files here or click to browse
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Supported formats: {allowedFileTypes.join(', ').toUpperCase()}
              </p>
              <p className="text-xs text-gray-500">
                Max file size: {Math.round(maxFileSize / 1024 / 1024)}MB | Max files: {maxFiles}
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={allowedFileTypes.map(type => `.${type}`).join(',')}
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
        )}

        {/* File List */}
        {selectedFiles.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Selected Files</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={clearAllFiles}
                disabled={isUploading}
              >
                Clear All
              </Button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {selectedFiles.map((filePreview) => {
                const IconComponent = getFileIcon(filePreview.file);
                
                return (
                  <div
                    key={filePreview.id}
                    className={cn(
                      'flex items-center space-x-3 p-3 border rounded-lg',
                      filePreview.error && 'border-red-200 bg-red-50',
                      filePreview.status === 'success' && 'border-green-200 bg-green-50'
                    )}
                  >
                    {filePreview.preview ? (
                      <img
                        src={filePreview.preview}
                        alt={filePreview.file.name}
                        className="w-10 h-10 object-cover rounded"
                      />
                    ) : (
                      <IconComponent className="h-10 w-10 text-gray-400" />
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {filePreview.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {Math.round(filePreview.file.size / 1024)} KB
                      </p>
                      {filePreview.error && (
                        <p className="text-xs text-red-600 mt-1">
                          {filePreview.error}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {getStatusIcon(filePreview.status)}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(filePreview.id)}
                        disabled={isUploading}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {isUploading && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Uploading files...</span>
              <span>{Math.round(uploadProgress)}%</span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {/* Upload Button */}
        {selectedFiles.length > 0 && selectedDatasetId && (
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-gray-600">
              {validFileCount} files ready to upload
              {errorFileCount > 0 && `, ${errorFileCount} with errors`}
            </div>
            <Button
              onClick={handleUpload}
              disabled={isUploading || validFileCount === 0}
              className="min-w-24"
            >
              {isUploading ? 'Uploading...' : `Upload ${validFileCount} Files`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};