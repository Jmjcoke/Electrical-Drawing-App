import React from 'react';
import {
  Box,
  Typography,
  LinearProgress,
  Card,
  CardContent,
  Chip,
  Stack
} from '@mui/material';
import {
  CheckCircle,
  Error as ErrorIcon,
  CloudUpload,
  Description
} from '@mui/icons-material';
import type { MultiFileUploadProgress, FileUploadProgress } from '../../types/api';

interface MultiFileProgressProps {
  progress: MultiFileUploadProgress;
  showIndividualFiles?: boolean;
  compact?: boolean;
}

const MultiFileProgress: React.FC<MultiFileProgressProps> = ({
  progress,
  showIndividualFiles = true,
  compact = false
}) => {
  const renderFileProgress = (file: FileUploadProgress) => {
    const getStatusIcon = () => {
      switch (file.status) {
        case 'completed':
          return <CheckCircle color="success" />;
        case 'error':
          return <ErrorIcon color="error" />;
        case 'uploading':
          return <CloudUpload color="primary" />;
        default:
          return <Description color="disabled" />;
      }
    };

    const getStatusColor = (): 'success' | 'error' | 'primary' | 'default' => {
      switch (file.status) {
        case 'completed':
          return 'success';
        case 'error':
          return 'error';
        case 'uploading':
          return 'primary';
        default:
          return 'default';
      }
    };

    if (compact) {
      return (
        <Box key={file.fileId} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
          {getStatusIcon()}
          <Typography variant="body2" sx={{ flex: 1 }}>
            {file.fileName}
          </Typography>
          <Chip 
            size="small" 
            label={`${file.percentage.toFixed(0)}%`}
            color={getStatusColor()}
            variant={file.status === 'pending' ? 'outlined' : 'filled'}
          />
        </Box>
      );
    }

    return (
      <Card key={file.fileId} variant="outlined" sx={{ mb: 1 }}>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {getStatusIcon()}
              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                {file.fileName}
              </Typography>
            </Box>
            <Chip 
              size="small" 
              label={file.status}
              color={getStatusColor()}
              variant={file.status === 'pending' ? 'outlined' : 'filled'}
            />
          </Box>
          
          {file.status === 'uploading' && (
            <Box>
              <LinearProgress
                variant="determinate"
                value={file.percentage}
                sx={{ height: 6, borderRadius: 3, mb: 1 }}
              />
              <Typography variant="caption" color="text.secondary">
                {file.percentage.toFixed(0)}% - {(file.loaded / 1024 / 1024).toFixed(1)}MB / {(file.total / 1024 / 1024).toFixed(1)}MB
              </Typography>
            </Box>
          )}
          
          {file.status === 'completed' && (
            <Typography variant="caption" color="success.main">
              Upload completed - {(file.total / 1024 / 1024).toFixed(1)}MB
            </Typography>
          )}
          
          {file.status === 'error' && (
            <Typography variant="caption" color="error.main">
              Upload failed
            </Typography>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Box>
      {/* Overall Progress */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6">
              Upload Progress
            </Typography>
            <Chip 
              label={`${progress.completedCount}/${progress.totalCount} completed`}
              color={progress.completedCount === progress.totalCount ? 'success' : 'primary'}
              variant="filled"
            />
          </Box>
          
          <LinearProgress
            variant="determinate"
            value={progress.overall.percentage}
            sx={{ height: 10, borderRadius: 5, mb: 1 }}
          />
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {progress.overall.percentage.toFixed(0)}% Complete
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {(progress.overall.loaded / 1024 / 1024).toFixed(1)}MB / {(progress.overall.total / 1024 / 1024).toFixed(1)}MB
            </Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Individual File Progress */}
      {showIndividualFiles && (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            File Details
          </Typography>
          {compact ? (
            <Stack spacing={0.5}>
              {progress.files.map(renderFileProgress)}
            </Stack>
          ) : (
            <Box>
              {progress.files.map(renderFileProgress)}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default MultiFileProgress;