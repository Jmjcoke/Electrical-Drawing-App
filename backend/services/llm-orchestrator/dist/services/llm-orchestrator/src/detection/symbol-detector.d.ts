/**
 * Symbol Detection Service
 *
 * Main orchestrator for electrical symbol detection using computer vision
 * and machine learning techniques
 */
import { EventEmitter } from 'events';
import { Pool } from 'pg';
import { SymbolDetectionResult, DetectedSymbol, DetectionJob, DetectionJobResult, DetectionSettings } from '../../../../shared/types/symbol-detection.types';
export declare class SymbolDetectionService extends EventEmitter {
    private imageProcessor;
    private patternMatcher;
    private mlClassifier;
    private confidenceScorer;
    private symbolValidator;
    private detectionQueue;
    private storageService;
    constructor(redisConfig: {
        host: string;
        port: number;
        password?: string;
    }, database: Pool);
    /**
     * Process a document for symbol detection with caching support
     */
    processDocument(documentId: string, sessionId: string, pdfBuffer: Buffer, settings?: Partial<DetectionSettings>): Promise<string>;
    /**
     * Process a single page for symbol detection with database integration
     */
    processPage(job: DetectionJob): Promise<SymbolDetectionResult>;
    /**
     * Merge pattern matching and ML classification results
     */
    private mergeDetectionResults;
    /**
     * Check if two symbols overlap spatially
     */
    private symbolsOverlap;
    /**
     * Setup Bull queue event handlers
     */
    private setupQueueHandlers;
    /**
     * Get job status
     */
    getJobStatus(jobId: string): Promise<DetectionJobResult | null>;
    /**
     * Cancel a detection job
     */
    cancelJob(jobId: string): Promise<boolean>;
    /**
     * Get queue statistics
     */
    getQueueStats(): Promise<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
    }>;
    /**
     * Get stored detection result by ID
     */
    getDetectionResult(resultId: string): Promise<SymbolDetectionResult | null>;
    /**
     * List detection results for a session
     */
    listSessionDetectionResults(sessionId: string, options?: {
        limit?: number;
        offset?: number;
        minConfidence?: number;
        symbolTypes?: string[];
        dateFrom?: Date;
        dateTo?: Date;
    }): Promise<{
        results: SymbolDetectionResult[];
        total: number;
        summary: import("../services/symbol-detection-storage.service").SessionDetectionSummary;
    }>;
    /**
     * Validate a detected symbol against the symbol library
     */
    validateDetectedSymbol(symbol: DetectedSymbol): Promise<{
        isValid: boolean;
        confidence: number;
        suggestions: string[];
    }>;
    /**
     * Get symbol library entries
     */
    getSymbolLibrary(filters?: {
        symbolType?: string;
        symbolCategory?: string;
    }): Promise<import("../repositories/symbol-detection.repository").SymbolLibraryEntry[]>;
    /**
     * Delete a detection result
     */
    deleteDetectionResult(resultId: string): Promise<boolean>;
    /**
     * Get comprehensive storage statistics
     */
    getStorageStatistics(): Promise<{
        totalDetectionResults: number;
        totalDetectedSymbols: number;
        cacheHitRate: number;
        averageProcessingTime: number;
        symbolTypeDistribution: Record<string, number>;
        storageUsage: {
            detectionResults: string;
            cache: string;
            symbolLibrary: string;
        };
    }>;
    /**
     * Perform cache and data cleanup
     */
    performCleanup(): Promise<{
        cacheEntriesRemoved: number;
        oldJobsRemoved: number;
    }>;
    /**
     * Clean up resources
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=symbol-detector.d.ts.map