/**
 * Conversion utilities for PDF processing and metadata management
 */
import { ConversionMetadata, ConversionResult } from '../types/api.types.js';
export interface DatabaseDocument {
    id: string;
    sessionId: string;
    filename: string;
    originalFilename: string;
    fileSize: number;
    contentType: string;
    uploadTimestamp: Date;
    processingStatus: 'uploaded' | 'processing' | 'ready' | 'error';
    filePath: string;
    imagePaths?: string[];
    pageCount?: number;
    processingMetadata?: ConversionMetadata;
    checksum: string;
}
/**
 * In-memory document storage for demo purposes
 * In production, this would be replaced with PostgreSQL database operations
 */
declare class DocumentDatabase {
    private documents;
    /**
     * Create or update document record
     */
    upsertDocument(document: DatabaseDocument): Promise<void>;
    /**
     * Get document by ID
     */
    getDocument(documentId: string): Promise<DatabaseDocument | null>;
    /**
     * Get all documents for a session
     */
    getDocumentsBySession(sessionId: string): Promise<DatabaseDocument[]>;
    /**
     * Update document processing status
     */
    updateProcessingStatus(documentId: string, status: 'uploaded' | 'processing' | 'ready' | 'error', conversionResult?: ConversionResult): Promise<void>;
    /**
     * Delete document
     */
    deleteDocument(documentId: string): Promise<boolean>;
    /**
     * Clean up documents for expired session
     */
    cleanupSessionDocuments(sessionId: string): Promise<number>;
    /**
     * Get conversion metrics for monitoring
     */
    getConversionMetrics(): Promise<{
        totalDocuments: number;
        processingDocuments: number;
        readyDocuments: number;
        errorDocuments: number;
        averageConversionTime: number;
    }>;
    /**
     * Health check for database
     */
    healthCheck(): Promise<{
        status: string;
        documentsCount: number;
    }>;
}
export declare const documentDatabase: DocumentDatabase;
/**
 * Utility functions for conversion metadata
 */
export declare class ConversionUtils {
    /**
     * Validate conversion result
     */
    static validateConversionResult(result: ConversionResult): boolean;
    /**
     * Calculate conversion metrics
     */
    static calculateMetrics(results: ConversionResult[]): {
        successRate: number;
        averageDuration: number;
        averagePageCount: number;
        totalImagesGenerated: number;
    };
    /**
     * Format file size for display
     */
    static formatFileSize(bytes: number): string;
    /**
     * Format duration for display
     */
    static formatDuration(milliseconds: number): string;
}
export {};
//# sourceMappingURL=conversion.d.ts.map