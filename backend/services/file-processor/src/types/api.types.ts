/**
 * Shared API type definitions for electrical drawing application
 * Supports multi-file upload, PDF conversion, and LLM processing
 */

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
  };
}

export interface UploadedFile {
  id: string;
  filename: string;
  originalFilename: string;
  size: number;
  contentType: string;
  uploadTimestamp: Date;
  processingStatus: 'uploaded' | 'processing' | 'ready' | 'error';
  filePath: string;
  imagePaths?: string[];
  pageCount?: number;
  processingMetadata?: ConversionMetadata;
  checksum: string;
}

export interface ConversionMetadata {
  conversionDurationMs: number;
  imageDimensions: Array<{
    page: number;
    width: number;
    height: number;
    dpi: number;
  }>;
  totalFileSize: number;
  imageFileSizes: number[];
  conversionTimestamp: Date;
  cacheHit: boolean;
}

export interface ConversionResult {
  documentId: string;
  imagePaths: string[];
  metadata: ConversionMetadata;
  success: boolean;
  error?: string;
}

export interface ConversionProgress {
  documentId: string;
  currentPage: number;
  totalPages: number;
  percentage: number;
  stage: 'starting' | 'converting' | 'storing' | 'complete' | 'error';
  estimatedTimeRemainingMs?: number;
}

export interface CacheEntry {
  documentId: string;
  checksum: string;
  imagePaths: string[];
  metadata: ConversionMetadata;
  accessTimestamp: Date;
  expiresAt: Date;
}

export interface MetricsData {
  conversionDurationSeconds: number;
  conversionSuccess: boolean;
  errorType?: 'pdf_corrupt' | 'timeout' | 'memory_error' | 'disk_space' | 'unknown';
  pageCount: number;
  fileSizeMB: number;
  cacheHit: boolean;
  memoryUsageMB: number;
  queueDepth: number;
}

export interface CleanupJob {
  sessionId: string;
  documentIds: string[];
  scheduledAt: Date;
  completedAt?: Date;
  filesRemoved: number;
  cacheEntriesRemoved: number;
}

export interface Session {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  status: 'active' | 'expired' | 'terminated';
  lastActivity: Date;
  documents: UploadedFile[];
}

export interface ConversionQueue {
  id: string;
  sessionId: string;
  documentId: string;
  priority: 'low' | 'normal' | 'high';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  error?: string;
}

// WebSocket event types
export interface WebSocketEvents {
  'conversion-progress': ConversionProgress;
  'conversion-complete': ConversionResult;
  'conversion-error': {
    documentId: string;
    error: string;
    retryable: boolean;
  };
  'queue-status': {
    position: number;
    estimatedWaitTimeMs: number;
  };
}

// API Request/Response types
export interface UploadRequest {
  sessionId: string;
  files: File[];
}

export interface UploadResponse {
  success: boolean;
  documents: UploadedFile[];
  errors?: Array<{
    filename: string;
    error: string;
  }>;
}

export interface ConversionRequest {
  documentId: string;
  sessionId: string;
  options?: {
    dpi?: number;
    format?: 'png' | 'jpg';
    quality?: number;
  };
}

export interface ImagesResponse {
  documentId: string;
  sessionId: string;
  images: Array<{
    page: number;
    path: string;
    url: string;
    dimensions: {
      width: number;
      height: number;
      dpi: number;
    };
  }>;
  metadata: ConversionMetadata;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  services: {
    redis: 'connected' | 'disconnected';
    storage: 'available' | 'full' | 'error';
    queue: 'running' | 'stopped' | 'overloaded';
  };
  metrics: {
    activeConversions: number;
    queueDepth: number;
    cacheHitRate: number;
    averageConversionTimeMs: number;
  };
}