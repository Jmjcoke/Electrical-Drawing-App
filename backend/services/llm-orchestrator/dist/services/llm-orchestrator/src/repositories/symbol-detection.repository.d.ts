/**
 * Symbol Detection Repository
 *
 * Database access layer for symbol detection results, jobs, and caching
 * Story: 4.1 Symbol Detection Engine
 * Task: 4.1.4 Database Storage Integration
 */
import { Pool } from 'pg';
import { SymbolDetectionResult, DetectionJob } from '../../../../shared/types/symbol-detection.types';
export interface DetectionCacheEntry {
    id: string;
    documentHash: string;
    pageNumber: number;
    detectionSettingsHash: string;
    cachedResult: SymbolDetectionResult;
    hitCount: number;
    lastAccessed: Date;
    expiresAt: Date;
    createdAt: Date;
}
export interface DetectionMetric {
    id: string;
    detectionResultId: string;
    metricType: string;
    metricValue: number;
    metricUnit?: string;
    benchmarkComparison?: any;
    createdAt: Date;
}
export interface SymbolLibraryEntry {
    id: string;
    symbolType: string;
    symbolCategory: string;
    symbolName: string;
    symbolDescription?: string;
    templateData?: Buffer;
    featureVector?: any;
    industryStandard?: string;
    version: number;
    createdAt: Date;
}
export declare class SymbolDetectionRepository {
    private db;
    constructor(db: Pool);
    /**
     * Store symbol detection results with all detected symbols
     */
    saveDetectionResult(result: SymbolDetectionResult): Promise<string>;
    /**
     * Retrieve detection results by ID with all symbols
     */
    getDetectionResult(resultId: string): Promise<SymbolDetectionResult | null>;
    /**
     * List detection results for a session with pagination
     */
    listDetectionResults(sessionId: string, limit?: number, offset?: number): Promise<{
        results: SymbolDetectionResult[];
        total: number;
    }>;
    /**
     * Detection job management
     */
    createDetectionJob(job: DetectionJob): Promise<string>;
    /**
     * Update detection job status and progress
     */
    updateDetectionJob(jobId: string, updates: Partial<Pick<DetectionJob, 'status' | 'progressStage' | 'progressPercent'>>): Promise<void>;
    /**
     * Get detection job by ID
     */
    getDetectionJob(jobId: string): Promise<DetectionJob | null>;
    /**
     * Cache management
     */
    getCachedResult(documentHash: string, pageNumber: number, settingsHash: string): Promise<SymbolDetectionResult | null>;
    /**
     * Store detection result in cache
     */
    cacheDetectionResult(documentHash: string, pageNumber: number, settingsHash: string, result: SymbolDetectionResult, expiresAt: Date): Promise<void>;
    /**
     * Clean expired cache entries
     */
    cleanExpiredCache(): Promise<number>;
    /**
     * Symbol library operations
     */
    getSymbolLibraryEntries(symbolType?: string, symbolCategory?: string): Promise<SymbolLibraryEntry[]>;
    /**
     * Store detection performance metrics
     */
    saveDetectionMetrics(detectionResultId: string, metrics: Array<{
        metricType: string;
        metricValue: number;
        metricUnit?: string;
        benchmarkComparison?: any;
    }>): Promise<void>;
    /**
     * Delete detection results and associated data
     */
    deleteDetectionResult(resultId: string): Promise<boolean>;
    /**
     * Helper to extract session ID from query ID (if follows expected pattern)
     */
    private extractSessionFromQueryId;
}
//# sourceMappingURL=symbol-detection.repository.d.ts.map