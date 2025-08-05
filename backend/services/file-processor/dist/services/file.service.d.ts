import { DatabaseDocument } from '../utils/conversion.js';
import { ConversionResult, ConversionProgress } from '../types/api.types.js';
export interface ProcessedFileInfo {
    path: string;
    previewUrl?: string;
    imagePaths?: string[];
    conversionResult?: ConversionResult;
    metadata: {
        pages?: number;
        size: number;
        processedAt: string;
        conversionDurationMs?: number;
        imageDimensions?: Array<{
            page: number;
            width: number;
            height: number;
            dpi: number;
        }>;
    };
}
declare class FileService {
    private pdfService;
    constructor();
    processFile(filePath: string, originalFile: Express.Multer.File, sessionId: string, documentId: string, progressCallback?: (progress: ConversionProgress) => void): Promise<ProcessedFileInfo>;
    /**
     * Get converted images for a document
     */
    getConvertedImages(documentId: string): Promise<string[]>;
    /**
     * Get processing status for a document
     */
    getProcessingStatus(documentId: string): Promise<{
        status: 'uploaded' | 'processing' | 'ready' | 'error';
        progress?: number;
        imagePaths?: string[];
        error?: string;
        metadata?: {
            pages?: number;
            conversionDurationMs?: number;
            fileSize?: number;
        };
    }>;
    /**
     * Get documents for a session
     */
    getSessionDocuments(sessionId: string): Promise<DatabaseDocument[]>;
    /**
     * Get conversion metrics
     */
    getConversionMetrics(): Promise<{
        totalDocuments: number;
        processingDocuments: number;
        readyDocuments: number;
        errorDocuments: number;
        averageConversionTime: number;
    }>;
    /**
     * Clean up session files and database records
     */
    cleanupSession(sessionId: string): Promise<number>;
    cleanupFile(filePath: string): Promise<void>;
}
export declare const fileService: FileService;
export {};
//# sourceMappingURL=file.service.d.ts.map