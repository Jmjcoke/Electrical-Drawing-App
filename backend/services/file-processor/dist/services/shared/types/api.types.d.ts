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
export declare enum UploadErrorCodes {
    FILE_TOO_LARGE = "FILE_TOO_LARGE",
    INVALID_FILE_TYPE = "INVALID_FILE_TYPE",
    CORRUPTED_FILE = "CORRUPTED_FILE",
    UPLOAD_FAILED = "UPLOAD_FAILED",
    PROCESSING_FAILED = "PROCESSING_FAILED",
    TOO_MANY_FILES = "TOO_MANY_FILES",
    TOTAL_SIZE_EXCEEDED = "TOTAL_SIZE_EXCEEDED",
    PARTIAL_UPLOAD_FAILURE = "PARTIAL_UPLOAD_FAILURE"
}
//# sourceMappingURL=api.types.d.ts.map