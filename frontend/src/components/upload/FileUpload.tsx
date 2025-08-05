import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  LinearProgress,
  Alert,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  Chip,
  Stack,
  Grid
} from '@mui/material';
import {
  CloudUpload,
  Cancel,
  CheckCircle,
  Error as ErrorIcon,
  Description,
  Delete,
  Add
} from '@mui/icons-material';
import { uploadFile } from '../../services/api';
import { useMultiFileUpload } from '../../hooks/useMultiFileUpload';
import FilePreview from './FilePreview';
import type { 
  UploadResponse, 
  SingleUploadResponse, 
  UploadProgress, 
  UploadErrorCodes,
  MultiFileUploadProgress 
} from '../../types/api';

interface FileUploadProps {
  onUploadSuccess?: (response: UploadResponse) => void;
  onUploadError?: (error: string) => void;
  onProgressUpdate?: (progress: MultiFileUploadProgress) => void;
  disabled?: boolean;
  multiFile?: boolean;
  maxFiles?: number;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onUploadSuccess,
  onUploadError,
  onProgressUpdate,
  disabled = false,
  multiFile = true,
  maxFiles = 3
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    files,
    isUploading,
    progress,
    response,
    error,
    warnings,
    suggestions,
    addFiles,
    removeFile,
    clearFiles,
    uploadFiles,
    cancelUpload,
    getTotalSize,
    getFileCount,
    canAddMoreFiles
  } = useMultiFileUpload({
    maxFiles,
    onUploadSuccess,
    onUploadError,
    onProgressUpdate
  });

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    if (multiFile) {
      await addFiles(selectedFiles);
    } else {
      // Single file mode - replace existing file
      clearFiles();
      await addFiles([selectedFiles[0]]);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [multiFile, addFiles, clearFiles]);

  const handleUpload = useCallback(() => {
    uploadFiles();
  }, [uploadFiles]);

  const handleCancel = useCallback(() => {
    cancelUpload();
  }, [cancelUpload]);

  const handleClear = useCallback(() => {
    clearFiles();
  }, [clearFiles]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
  }, []);

  const handleDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault();
    if (!canAddMoreFiles() && multiFile) return;
    
    const droppedFiles = Array.from(event.dataTransfer.files);
    if (droppedFiles.length > 0) {
      if (multiFile) {
        await addFiles(droppedFiles);
      } else {
        clearFiles();
        await addFiles([droppedFiles[0]]);
      }
    }
  }, [multiFile, canAddMoreFiles, addFiles, clearFiles]);

  const renderFileList = () => {
    if (files.length === 0) return null;

    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Selected Files ({getFileCount()}/{maxFiles})
        </Typography>
        <Stack spacing={1}>
          {files.map((file) => (
            <Card key={file.id} variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <Description sx={{ mr: 1, color: 'primary.main' }} />
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                      {file.file.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {(file.file.size / 1024 / 1024).toFixed(1)}MB
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Chip
                    size="small"
                    label={file.status}
                    color={
                      file.status === 'completed' ? 'success' :
                      file.status === 'error' ? 'error' :
                      file.status === 'uploading' ? 'primary' : 'default'
                    }
                    variant={file.status === 'pending' ? 'outlined' : 'filled'}
                  />
                  {!isUploading && (
                    <IconButton size="small" onClick={() => removeFile(file.id)}>
                      <Delete />
                    </IconButton>
                  )}
                </Box>
              </Box>
              {file.status === 'uploading' && progress && (
                <Box sx={{ mt: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={progress.files.find(f => f.fileName === file.file.name)?.percentage || 0}
                    sx={{ height: 4, borderRadius: 2 }}
                  />
                </Box>
              )}
            </Card>
          ))}
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Total size: {(getTotalSize() / 1024 / 1024).toFixed(1)}MB / 30MB
        </Typography>
      </Box>
    );
  };

  const renderSuccessState = () => {
    if (!response) return null;

    return (
      <Box sx={{ mt: 2 }}>
        <Card sx={{ bgcolor: 'success.light', color: 'success.contrastText', mb: 2 }}>
          <CardContent sx={{ textAlign: 'center', py: 2 }}>
            <CheckCircle sx={{ fontSize: 32, mb: 1 }} />
            <Typography variant="h6" gutterBottom>
              Upload Successful!
            </Typography>
            <Typography variant="body2">
              {response.files.length} file{response.files.length > 1 ? 's' : ''} uploaded successfully and ready for analysis
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  };

  const renderUploadArea = () => {
    const showAddMore = multiFile && canAddMoreFiles() && !isUploading;
    const hasFiles = files.length > 0;

    return (
      <Card
        sx={{
          border: '2px dashed',
          borderColor: error ? 'error.main' : 'primary.main',
          bgcolor: error ? 'error.light' : 'background.paper',
          cursor: disabled || (!showAddMore && hasFiles) ? 'default' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          '&:hover': {
            bgcolor: disabled || (!showAddMore && hasFiles) ? undefined : 'action.hover'
          }
        }}
        onClick={() => {
          if (!disabled && (showAddMore || !hasFiles)) {
            fileInputRef.current?.click();
          }
        }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          {hasFiles ? (
            <>
              <Add sx={{ fontSize: 48, mb: 2, color: 'primary.main' }} />
              <Typography variant="h6" gutterBottom>
                {showAddMore ? 'Add More Files' : `${getFileCount()}/${maxFiles} Files Selected`}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {showAddMore 
                  ? `You can add ${maxFiles - getFileCount()} more file${maxFiles - getFileCount() > 1 ? 's' : ''}`
                  : 'Maximum files reached'
                }
              </Typography>
            </>
          ) : (
            <>
              <CloudUpload sx={{ fontSize: 48, mb: 2, color: 'primary.main' }} />
              <Typography variant="h6" gutterBottom>
                Upload PDF Files
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Click here or drag and drop your PDF files
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Maximum {maxFiles} files, 10MB each, 30MB total
              </Typography>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Box>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple={multiFile}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        disabled={disabled}
      />
      
      {renderUploadArea()}
      {renderFileList()}
      
      {files.length > 0 && !response && (
        <Box sx={{ mt: 2, display: 'flex', gap: 2, justifyContent: 'center' }}>
          {isUploading ? (
            <Button
              variant="outlined"
              onClick={handleCancel}
              startIcon={<Cancel />}
              disabled={disabled}
            >
              Cancel Upload
            </Button>
          ) : (
            <>
              <Button
                variant="contained"
                onClick={handleUpload}
                disabled={disabled || files.length === 0}
                startIcon={<CloudUpload />}
              >
                Upload {files.length} File{files.length > 1 ? 's' : ''}
              </Button>
              <Button
                variant="outlined"
                onClick={handleClear}
                disabled={disabled}
                startIcon={<Delete />}
              >
                Clear All
              </Button>
            </>
          )}
        </Box>
      )}

      {isUploading && progress && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" gutterBottom>
            Overall Progress: {progress.completedCount}/{progress.totalCount} files completed
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress.overall.percentage}
            sx={{ height: 8, borderRadius: 4 }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            {progress.overall.percentage.toFixed(0)}% - {(progress.overall.loaded / 1024 / 1024).toFixed(1)}MB / {(progress.overall.total / 1024 / 1024).toFixed(1)}MB
          </Typography>
        </Box>
      )}
      
      {renderSuccessState()}
      
      {response && (
        <Box sx={{ mt: 3 }}>
          <FilePreview 
            files={response.files}
            onFileRemove={(fileId) => {
              // Handle file removal if needed
              console.log('Remove file:', fileId);
            }}
            onFileDownload={(fileId) => {
              // Handle file download if needed
              console.log('Download file:', fileId);
            }}
            showActions={true}
            readOnly={false}
          />
        </Box>
      )}
      
      {error && (
        <Alert 
          severity="error" 
          sx={{ mt: 2 }}
          icon={<ErrorIcon />}
          action={
            <Button size="small" onClick={handleClear}>
              Clear
            </Button>
          }
        >
          <Typography variant="body2" sx={{ mb: 1 }}>
            {error}
          </Typography>
          {suggestions.length > 0 && (
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 'medium' }}>
                Suggestions:
              </Typography>
              <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
                {suggestions.map((suggestion, index) => (
                  <li key={index}>
                    <Typography variant="caption">{suggestion}</Typography>
                  </li>
                ))}
              </ul>
            </Box>
          )}
        </Alert>
      )}

      {warnings.length > 0 && !error && (
        <Alert 
          severity="warning" 
          sx={{ mt: 2 }}
        >
          <Typography variant="body2" sx={{ mb: 1 }}>
            {warnings.length === 1 ? 'Warning:' : `${warnings.length} warnings:`}
          </Typography>
          <ul style={{ margin: 0, paddingLeft: '16px' }}>
            {warnings.map((warning, index) => (
              <li key={index}>
                <Typography variant="caption">{warning}</Typography>
              </li>
            ))}
          </ul>
        </Alert>
      )}
    </Box>
  );
};

export default FileUpload;