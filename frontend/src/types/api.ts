export interface UploadedFile {
  fileId: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  previewUrl?: string;
  processingStatus: 'uploading' | 'processing' | 'ready' | 'error';
  // Conversion-related fields
  imagePaths?: string[];
  conversionMetadata?: {
    pageCount?: number;
    conversionDurationMs?: number;
    imageDimensions?: Array<{
      page: number;
      width: number;
      height: number;
      dpi: number;
    }>;
    cacheHit?: boolean;
  };
  conversionProgress?: ConversionProgress;
  conversionError?: string;
}

export interface UploadResponse {
  success: boolean;
  files: UploadedFile[];
  totalSize: number;
  sessionId: string;
}

export interface SingleUploadResponse {
  success: boolean;
  fileId: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  previewUrl?: string;
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
  };
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface FileUploadProgress extends UploadProgress {
  fileId: string;
  fileName: string;
  status: 'pending' | 'uploading' | 'completed' | 'error';
}

export interface MultiFileUploadProgress {
  files: FileUploadProgress[];
  overall: UploadProgress;
  completedCount: number;
  totalCount: number;
}

export enum UploadErrorCodes {
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  CORRUPTED_FILE = 'CORRUPTED_FILE',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  TOO_MANY_FILES = 'TOO_MANY_FILES',
  TOTAL_SIZE_EXCEEDED = 'TOTAL_SIZE_EXCEEDED',
  PARTIAL_UPLOAD_FAILURE = 'PARTIAL_UPLOAD_FAILURE',
  // Conversion-related errors
  CONVERSION_FAILED = 'CONVERSION_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  PDF_ENCRYPTED = 'PDF_ENCRYPTED',
  PDF_CORRUPTED = 'PDF_CORRUPTED'
}

// Conversion-related interfaces
export interface ConversionProgress {
  documentId: string;
  currentPage: number;
  totalPages: number;
  percentage: number;
  stage: 'starting' | 'converting' | 'storing' | 'complete' | 'error';
  estimatedTimeRemainingMs?: number;
}

export interface ConversionCompleteEvent {
  documentId: string;
  imagePaths: string[];
  success: boolean;
  durationMs: number;
  pageCount: number;
}

export interface ConversionErrorEvent {
  documentId: string;
  error: string;
  retryable: boolean;
}

// WebSocket event types
export interface WebSocketEvents {
  'conversion-progress': ConversionProgress;
  'conversion-complete': ConversionCompleteEvent;
  'conversion-error': ConversionErrorEvent;
}

// Enhanced upload response with conversion support
export interface EnhancedUploadResponse extends UploadResponse {
  conversionInfo?: {
    totalConversions: number;
    estimatedCompletionTime?: number;
    supportedFormats: string[];
  };
}