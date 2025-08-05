/**
 * Symbol Detection Storage Service
 *
 * High-level service for managing symbol detection data storage, caching, and session management
 * Story: 4.1 Symbol Detection Engine
 * Task: 4.1.4 Database Storage Integration
 */
import { Pool } from 'pg';
import { SymbolDetectionResult, DetectedSymbol, DetectionJob, DetectionSettings } from '../../../../shared/types/symbol-detection.types';
import { SymbolLibraryEntry } from '../repositories/symbol-detection.repository';
export interface StorageServiceConfig {
    cacheExpirationHours: number;
    maxCacheEntries: number;
    enablePerformanceMetrics: boolean;
    cleanupIntervalMinutes: number;
}
export interface SessionDetectionSummary {
    sessionId: string;
    totalDetections: number;
    totalSymbolsFound: number;
    averageConfidence: number;
    processingTimeTotal: number;
    lastDetectionAt: Date;
    symbolTypeCounts: Record<string, number>;
}
export declare class SymbolDetectionStorageService {
    private repository;
    private config;
    private cleanupTimer?;
    constructor(database: Pool, config?: Partial<StorageServiceConfig>);
    /**
     * Store detection results with intelligent caching and metrics
     */
    storeDetectionResult(result: SymbolDetectionResult, documentBuffer?: Buffer, settings?: DetectionSettings): Promise<{
        resultId: string;
        cached: boolean;
    }>;
    /**
     * Retrieve detection result with cache fallback
     */
    getDetectionResult(resultId: string): Promise<SymbolDetectionResult | null>;
    /**
     * Check cache for existing detection result
     */
    getCachedDetectionResult(documentBuffer: Buffer, pageNumber: number, settings: DetectionSettings): Promise<SymbolDetectionResult | null>;
    /**
     * List detection results for a session with comprehensive filtering
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
        summary: SessionDetectionSummary;
    }>;
    /**
     * Detection job lifecycle management
     */
    createDetectionJob(documentId: string, sessionId: string, pageNumber: number, settings: DetectionSettings, imageBuffer: Buffer): Promise<string>;
    /**
     * Update detection job progress
     */
    updateJobProgress(jobId: string, status: DetectionJob['status'], progressStage?: string, progressPercent?: number): Promise<void>;
    /**
     * Complete detection job with result
     */
    completeDetectionJob(jobId: string, result: SymbolDetectionResult): Promise<void>;
    /**
     * Get detection job status
     */
    getDetectionJobStatus(jobId: string): Promise<DetectionJob | null>;
    /**
     * Symbol library management
     */
    getSymbolLibrary(filters?: {
        symbolType?: string;
        symbolCategory?: string;
    }): Promise<SymbolLibraryEntry[]>;
    /**
     * Validate detected symbol against library
     */
    validateDetectedSymbol(symbol: DetectedSymbol): Promise<{
        isValid: boolean;
        confidence: number;
        suggestions: string[];
    }>;
    /**
     * Delete detection results and clean up associated data
     */
    deleteDetectionResult(resultId: string): Promise<boolean>;
    /**
     * Clean up expired cache and old data
     */
    performCleanup(): Promise<{
        cacheEntriesRemoved: number;
        oldJobsRemoved: number;
    }>;
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
     * Shutdown cleanup
     */
    shutdown(): Promise<void>;
    private calculateDocumentHash;
    private calculateSettingsHash;
    private storePerformanceMetrics;
    private generateSessionSummary;
    private startCleanupScheduler;
}
//# sourceMappingURL=symbol-detection-storage.service.d.ts.map