export interface UploadRequest {
  file: Express.Multer.File;
}

export interface MultiFileUploadRequest {
  files: Express.Multer.File[];
}

export interface UploadedFile {
  fileId: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  previewUrl?: string;
  processingStatus: 'uploading' | 'processing' | 'ready' | 'error';
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

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  fileInfo?: {
    size: number;
    mimeType: string;
    pages?: number;
  };
}

export enum UploadErrorCodes {
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  CORRUPTED_FILE = 'CORRUPTED_FILE',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  PROCESSING_FAILED = 'PROCESSING_FAILED',
  TOO_MANY_FILES = 'TOO_MANY_FILES',
  TOTAL_SIZE_EXCEEDED = 'TOTAL_SIZE_EXCEEDED',
  PARTIAL_UPLOAD_FAILURE = 'PARTIAL_UPLOAD_FAILURE'
}

// LLM Analysis Types
export interface AnalysisRequest {
  sessionId: string;
  documentId: string;
  prompt?: string;
  templateName?: string;
  templateVariables?: Record<string, string | number | boolean>;
  options?: {
    maxTokens?: number;
    temperature?: number;
    model?: string;
  };
}

export interface AnalysisResult {
  analysisId: string;
  result: string;
  confidence: number;
  processingTime: number;
  provider: string;
  timestamp: Date;
  metadata: {
    model: string;
    tokenUsage?: {
      readonly prompt: number;
      readonly completion: number;
      readonly total: number;
    };
    readonly imageCount: number;
    readonly promptLength: number;
  };
}

export interface AnalysisResponse extends AnalysisResult {
  templateUsed?: string;
}

export interface AnalysisStatusResponse {
  analysisId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: string;
  error?: string;
  processingTime?: number;
  timestamp: Date;
}

export enum AnalysisErrorCodes {
  RATE_LIMITED = 'RATE_LIMITED',
  IMAGES_NOT_FOUND = 'IMAGES_NOT_FOUND',
  MISSING_ANALYSIS_ID = 'MISSING_ANALYSIS_ID',
  ANALYSIS_NOT_FOUND = 'ANALYSIS_NOT_FOUND',
  INVALID_REQUEST = 'INVALID_REQUEST',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  TIMEOUT = 'TIMEOUT',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR'
}