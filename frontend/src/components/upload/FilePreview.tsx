import React, { useState, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  IconButton,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Chip,
  Tooltip,
  CircularProgress,
  Alert,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Visibility,
  Delete,
  Download,
  PictureAsPdf,
  Close,
  ZoomIn,
  ZoomOut,
  Fullscreen,
  Error as ErrorIcon,
  ExpandMore,
  CheckCircle,
  Warning,
  Image as ImageIcon,
  Transform
} from '@mui/icons-material';
import type { UploadedFile } from '../../types/api';

interface FilePreviewProps {
  files: UploadedFile[];
  onFileRemove?: (fileId: string) => void;
  onFileDownload?: (fileId: string) => void;
  showActions?: boolean;
  readOnly?: boolean;
}

interface PreviewDialogState {
  open: boolean;
  file: UploadedFile | null;
  zoom: number;
}

const FilePreview: React.FC<FilePreviewProps> = ({
  files,
  onFileRemove,
  onFileDownload,
  showActions = true,
  readOnly = false
}) => {
  const [dialogState, setDialogState] = useState<PreviewDialogState>({
    open: false,
    file: null,
    zoom: 1.0
  });
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  const handlePreview = useCallback((file: UploadedFile) => {
    setDialogState({
      open: true,
      file,
      zoom: 1.0
    });
  }, []);

  const handleClosePreview = useCallback(() => {
    setDialogState({
      open: false,
      file: null,
      zoom: 1.0
    });
  }, []);

  const handleZoomIn = useCallback(() => {
    setDialogState(prev => ({
      ...prev,
      zoom: Math.min(prev.zoom * 1.2, 3.0)
    }));
  }, []);

  const handleZoomOut = useCallback(() => {
    setDialogState(prev => ({
      ...prev,
      zoom: Math.max(prev.zoom / 1.2, 0.5)
    }));
  }, []);

  const handleImageError = useCallback((fileId: string) => {
    setImageErrors(prev => new Set([...prev, fileId]));
  }, []);

  const formatFileSize = (bytes: number): string => {
    return (bytes / 1024 / 1024).toFixed(1) + 'MB';
  };

  const getStatusColor = (status: UploadedFile['processingStatus']) => {
    switch (status) {
      case 'ready': return 'success';
      case 'processing': return 'warning';
      case 'error': return 'error';
      case 'uploading': return 'info';
      default: return 'default';
    }
  };

  const getStatusIcon = (file: UploadedFile) => {
    switch (file.processingStatus) {
      case 'ready':
        return file.imagePaths && file.imagePaths.length > 0 ? 
          <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} /> :
          <CheckCircle sx={{ fontSize: 16, color: 'success.main' }} />;
      case 'processing':
        return <CircularProgress size={16} />;
      case 'error':
        return <ErrorIcon sx={{ fontSize: 16, color: 'error.main' }} />;
      default:
        return null;
    }
  };

  const renderConversionProgress = (file: UploadedFile) => {
    if (!file.conversionProgress || file.processingStatus !== 'processing') return null;

    const progress = file.conversionProgress;
    return (
      <Box sx={{ mt: 1, width: '100%' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            {progress.stage === 'starting' && 'Starting conversion...'}
            {progress.stage === 'converting' && `Converting page ${progress.currentPage}/${progress.totalPages}`}
            {progress.stage === 'storing' && 'Storing images...'}
            {progress.stage === 'complete' && 'Conversion complete'}
            {progress.stage === 'error' && 'Conversion failed'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {progress.percentage}%
          </Typography>
        </Box>
        <LinearProgress 
          variant="determinate" 
          value={progress.percentage} 
          sx={{ height: 4, borderRadius: 2 }}
        />
        {progress.estimatedTimeRemainingMs && progress.estimatedTimeRemainingMs > 1000 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Est. {Math.round(progress.estimatedTimeRemainingMs / 1000)}s remaining
          </Typography>
        )}
      </Box>
    );
  };

  const renderConvertedImages = (file: UploadedFile) => {
    if (!file.imagePaths || file.imagePaths.length === 0) return null;

    return (
      <Accordion sx={{ mt: 1 }}>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ImageIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption">
              {file.imagePaths.length} converted image{file.imagePaths.length > 1 ? 's' : ''}
            </Typography>
            {file.conversionMetadata?.cacheHit && (
              <Chip size="small" label="Cached" variant="outlined" />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={1}>
            {file.imagePaths.map((imagePath, index) => (
              <Grid item xs={6} key={index}>
                <Box
                  sx={{
                    width: '100%',
                    height: 60,
                    bgcolor: 'grey.100',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'grey.200' }
                  }}
                  onClick={() => handlePreview(file)}
                >
                  <img
                    src={`/api/v1/files/image/${imagePath.split('/').pop()}`}
                    alt={`Page ${index + 1}`}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain'
                    }}
                    onError={() => {
                      // Handle image load error - show placeholder
                    }}
                  />
                </Box>
                <Typography variant="caption" align="center" display="block">
                  Page {index + 1}
                </Typography>
              </Grid>
            ))}
          </Grid>
          {file.conversionMetadata && (
            <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="caption" color="text.secondary">
                Converted in {file.conversionMetadata.conversionDurationMs}ms
                {file.conversionMetadata.cacheHit && ' (from cache)'}
              </Typography>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>
    );
  };

  const renderThumbnail = (file: UploadedFile) => {
    const hasError = imageErrors.has(file.fileId);
    const isProcessing = file.processingStatus === 'processing';
    const hasConvertedImages = file.imagePaths && file.imagePaths.length > 0;
    const hasPreview = (file.previewUrl || hasConvertedImages) && !hasError;

    // Use first converted image as preview if available
    const previewSrc = hasConvertedImages 
      ? `/api/v1/files/image/${file.imagePaths![0].split('/').pop()}`
      : file.previewUrl;

    return (
      <Box
        sx={{
          width: '100%',
          height: 120,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'grey.100',
          borderRadius: 1,
          overflow: 'hidden',
          cursor: hasPreview ? 'pointer' : 'default',
          position: 'relative'
        }}
        onClick={hasPreview ? () => handlePreview(file) : undefined}
      >
        {isProcessing ? (
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress size={24} sx={{ mb: 1 }} />
            <Typography variant="caption" color="text.secondary">
              {file.conversionProgress?.stage === 'converting' ? 'Converting...' : 'Processing...'}
            </Typography>
          </Box>
        ) : hasPreview ? (
          <>
            <img
              src={previewSrc}
              alt={`Preview of ${file.originalName}`}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain'
              }}
              onError={() => handleImageError(file.fileId)}
            />
            {hasConvertedImages && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  bgcolor: 'primary.main',
                  color: 'white',
                  borderRadius: '50%',
                  width: 20,
                  height: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Typography variant="caption" sx={{ fontSize: '10px' }}>
                  {file.imagePaths!.length}
                </Typography>
              </Box>
            )}
          </>
        ) : (
          <Box sx={{ textAlign: 'center' }}>
            {hasError ? (
              <>
                <ErrorIcon sx={{ fontSize: 32, color: 'error.main', mb: 1 }} />
                <Typography variant="caption" color="error.main">
                  {file.conversionError || 'Preview failed'}
                </Typography>
              </>
            ) : (
              <>
                <PictureAsPdf sx={{ fontSize: 32, color: 'primary.main', mb: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  PDF File
                </Typography>
              </>
            )}
          </Box>
        )}
      </Box>
    );
  };

  const renderFileCard = (file: UploadedFile) => (
    <Grid item xs={12} sm={6} md={4} key={file.fileId}>
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flex: 1 }}>
          {renderThumbnail(file)}
          
          <Box sx={{ mt: 2 }}>
            <Tooltip title={file.originalName}>
              <Typography 
                variant="subtitle2" 
                noWrap 
                sx={{ fontWeight: 'medium' }}
              >
                {file.originalName}
              </Typography>
            </Tooltip>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
              <Typography variant="caption" color="text.secondary">
                {formatFileSize(file.size)}
                {file.conversionMetadata?.pageCount && ` • ${file.conversionMetadata.pageCount} pages`}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {getStatusIcon(file)}
                <Chip
                  size="small"
                  label={file.processingStatus}
                  color={getStatusColor(file.processingStatus)}
                  variant="outlined"
                />
              </Box>
            </Box>
            
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Uploaded: {new Date(file.uploadedAt).toLocaleString()}
            </Typography>

            {/* Render conversion progress if processing */}
            {renderConversionProgress(file)}

            {/* Show conversion error if failed */}
            {file.processingStatus === 'error' && file.conversionError && (
              <Alert severity="error" sx={{ mt: 1, py: 0.5 }}>
                <Typography variant="caption">
                  {file.conversionError}
                </Typography>
              </Alert>
            )}

            {/* Render converted images if available */}
            {renderConvertedImages(file)}
          </Box>
        </CardContent>
        
        {showActions && !readOnly && (
          <Box sx={{ p: 1, display: 'flex', gap: 1, justifyContent: 'center' }}>
            {file.previewUrl && !imageErrors.has(file.fileId) && (
              <Tooltip title="View">
                <IconButton size="small" onClick={() => handlePreview(file)}>
                  <Visibility />
                </IconButton>
              </Tooltip>
            )}
            {onFileDownload && (
              <Tooltip title="Download">
                <IconButton size="small" onClick={() => onFileDownload(file.fileId)}>
                  <Download />
                </IconButton>
              </Tooltip>
            )}
            {onFileRemove && (
              <Tooltip title="Remove">
                <IconButton 
                  size="small" 
                  color="error" 
                  onClick={() => onFileRemove(file.fileId)}
                >
                  <Delete />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )}
      </Card>
    </Grid>
  );

  const renderPreviewDialog = () => {
    if (!dialogState.file) return null;

    const file = dialogState.file;
    const hasError = imageErrors.has(file.fileId);

    return (
      <Dialog
        open={dialogState.open}
        onClose={handleClosePreview}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { height: '80vh' }
        }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" noWrap sx={{ flex: 1 }}>
            {file.originalName}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <IconButton onClick={handleZoomOut} disabled={dialogState.zoom <= 0.5}>
              <ZoomOut />
            </IconButton>
            <Typography variant="body2" sx={{ alignSelf: 'center', minWidth: '60px', textAlign: 'center' }}>
              {Math.round(dialogState.zoom * 100)}%
            </Typography>
            <IconButton onClick={handleZoomIn} disabled={dialogState.zoom >= 3.0}>
              <ZoomIn />
            </IconButton>
            <IconButton onClick={handleClosePreview}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'auto' }}>
          {(() => {
            const hasConvertedImages = file.imagePaths && file.imagePaths.length > 0;
            const previewSrc = hasConvertedImages 
              ? `/api/v1/files/image/${file.imagePaths![0].split('/').pop()}`
              : file.previewUrl;

            return (previewSrc && !hasError) ? (
              <Box sx={{ textAlign: 'center' }}>
                <img
                  src={previewSrc}
                  alt={`Full preview of ${file.originalName}`}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    transform: `scale(${dialogState.zoom})`,
                    transition: 'transform 0.2s ease-in-out'
                  }}
                  onError={() => handleImageError(file.fileId)}
                />
                {hasConvertedImages && file.imagePaths!.length > 1 && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                    Page 1 of {file.imagePaths!.length} (showing first page)
                  </Typography>
                )}
              </Box>
            ) : (
              <Alert severity="error" sx={{ m: 2 }}>
                {file.conversionError || 'Preview not available for this file'}
              </Alert>
            );
          })()}
        </DialogContent>
        
        <DialogActions>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            {formatFileSize(file.size)} • {file.processingStatus}
          </Typography>
          {onFileDownload && (
            <Button onClick={() => onFileDownload(file.fileId)} startIcon={<Download />}>
              Download
            </Button>
          )}
          <Button onClick={handleClosePreview}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  if (files.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" color="text.secondary">
          No files to preview
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        File Preview ({files.length} file{files.length > 1 ? 's' : ''})
      </Typography>
      
      <Grid container spacing={2}>
        {files.map(renderFileCard)}
      </Grid>
      
      {renderPreviewDialog()}
    </Box>
  );
};

export default FilePreview;