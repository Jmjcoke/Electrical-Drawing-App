/**
 * PDF to Image Conversion Service
 * Handles high-resolution PDF to PNG conversion with monitoring, caching, and resource management
 */
import { ConversionResult } from '../types/api.types.js';
export interface ConversionOptions {
    dpi?: number;
    format?: 'png' | 'jpg';
    quality?: number;
    outputDir?: string;
}
export interface ProcessingProgress {
    documentId: string;
    currentPage: number;
    totalPages: number;
    percentage: number;
    stage: 'starting' | 'converting' | 'storing' | 'complete' | 'error';
    estimatedTimeRemainingMs?: number;
}
export declare class PdfService {
    private redis;
    private baseStoragePath;
    private defaultOptions;
    private activeConversions;
    private cacheStats;
    constructor(redisUrl: string, baseStoragePath: string);
    /**
     * Convert PDF to images with caching, monitoring, and progress tracking
     */
    convertPdfToImages(documentId: string, sessionId: string, pdfBuffer: Buffer, originalFilename: string, options?: ConversionOptions, progressCallback?: (progress: ProcessingProgress) => void): Promise<ConversionResult>;
    /**
     * Check if conversion result exists in cache
     */
    private checkCache;
    /**
     * Cache conversion result
     */
    private cacheResult;
    /**
     * Generate cache key from document ID and content checksum
     */
    private generateCacheKey;
    /**
     * Generate SHA-256 checksum of PDF content
     */
    private generateChecksum;
    /**
     * Get conversion metrics for monitoring
     */
    getMetrics(): Record<string, number>;
    /**
     * Clean up cached entries for expired sessions
     */
    cleanupCache(sessionId: string): Promise<number>;
    /**
     * Health check for PDF service
     */
    healthCheck(): Promise<{
        status: string;
        metrics: Record<string, number>;
    }>;
    /**
     * Validate PDF buffer before conversion
     */
    private validatePdfBuffer;
    /**
     * Attempt fallback conversion with different settings
     */
    private attemptFallbackConversion;
    /**
     * Enhanced error categorization with more specific error types
     */
    private categorizeError;
    /**
     * Create recovery suggestions based on error type
     */
    private getRecoverySuggestions;
    /**
     * Graceful shutdown
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=pdf.service.d.ts.map