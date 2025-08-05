"use strict";
/**
 * Symbol Detection Storage Service
 *
 * High-level service for managing symbol detection data storage, caching, and session management
 * Story: 4.1 Symbol Detection Engine
 * Task: 4.1.4 Database Storage Integration
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SymbolDetectionStorageService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const symbol_detection_types_1 = require("../../../../shared/types/symbol-detection.types");
const symbol_detection_repository_1 = require("../repositories/symbol-detection.repository");
class SymbolDetectionStorageService {
    constructor(database, config = {}) {
        this.repository = new symbol_detection_repository_1.SymbolDetectionRepository(database);
        this.config = {
            cacheExpirationHours: 24,
            maxCacheEntries: 1000,
            enablePerformanceMetrics: true,
            cleanupIntervalMinutes: 60,
            ...config
        };
        this.startCleanupScheduler();
    }
    /**
     * Store detection results with intelligent caching and metrics
     */
    async storeDetectionResult(result, documentBuffer, settings) {
        try {
            // Store the detection result in database
            const resultId = await this.repository.saveDetectionResult(result);
            // Cache result if document buffer is provided
            let cached = false;
            if (documentBuffer && settings) {
                const documentHash = this.calculateDocumentHash(documentBuffer);
                const settingsHash = this.calculateSettingsHash(settings);
                const expiresAt = new Date(Date.now() + this.config.cacheExpirationHours * 60 * 60 * 1000);
                await this.repository.cacheDetectionResult(documentHash, result.pageNumber, settingsHash, result, expiresAt);
                cached = true;
            }
            // Store performance metrics if enabled
            if (this.config.enablePerformanceMetrics) {
                await this.storePerformanceMetrics(resultId, result);
            }
            return { resultId, cached };
        }
        catch (error) {
            throw new symbol_detection_types_1.SymbolDetectionError('Failed to store detection result', 'STORAGE_SAVE_ERROR', { originalError: error, resultId: result.id });
        }
    }
    /**
     * Retrieve detection result with cache fallback
     */
    async getDetectionResult(resultId) {
        return await this.repository.getDetectionResult(resultId);
    }
    /**
     * Check cache for existing detection result
     */
    async getCachedDetectionResult(documentBuffer, pageNumber, settings) {
        try {
            const documentHash = this.calculateDocumentHash(documentBuffer);
            const settingsHash = this.calculateSettingsHash(settings);
            return await this.repository.getCachedResult(documentHash, pageNumber, settingsHash);
        }
        catch (error) {
            // Cache errors should not break the main flow
            console.warn('Cache lookup failed:', error);
            return null;
        }
    }
    /**
     * List detection results for a session with comprehensive filtering
     */
    async listSessionDetectionResults(sessionId, options = {}) {
        try {
            const { limit = 20, offset = 0 } = options;
            // Get paginated results
            const { results } = await this.repository.listDetectionResults(sessionId, limit, offset);
            // Apply client-side filters (could be optimized to SQL level)
            let filteredResults = results;
            if (options.minConfidence !== undefined) {
                filteredResults = filteredResults.filter(r => r.overallConfidence >= options.minConfidence);
            }
            if (options.symbolTypes && options.symbolTypes.length > 0) {
                filteredResults = filteredResults.filter(r => r.detectedSymbols.some((s) => options.symbolTypes.includes(s.symbolType)));
            }
            if (options.dateFrom) {
                filteredResults = filteredResults.filter(r => r.createdAt >= options.dateFrom);
            }
            if (options.dateTo) {
                filteredResults = filteredResults.filter(r => r.createdAt <= options.dateTo);
            }
            // Generate session summary
            const summary = this.generateSessionSummary(sessionId, results);
            return {
                results: filteredResults,
                total: filteredResults.length,
                summary
            };
        }
        catch (error) {
            throw new symbol_detection_types_1.SymbolDetectionError('Failed to list session detection results', 'STORAGE_LIST_ERROR', { originalError: error, sessionId });
        }
    }
    /**
     * Detection job lifecycle management
     */
    async createDetectionJob(documentId, sessionId, pageNumber, settings, imageBuffer) {
        const jobId = crypto_1.default.randomUUID();
        const job = {
            id: jobId,
            documentId,
            sessionId,
            pageNumber,
            imageBuffer,
            settings,
            createdAt: new Date(),
            status: 'pending'
        };
        await this.repository.createDetectionJob(job);
        return jobId;
    }
    /**
     * Update detection job progress
     */
    async updateJobProgress(jobId, status, progressStage, progressPercent) {
        await this.repository.updateDetectionJob(jobId, {
            status,
            progressStage,
            progressPercent
        });
    }
    /**
     * Complete detection job with result
     */
    async completeDetectionJob(jobId, result) {
        try {
            // Store the detection result
            await this.repository.saveDetectionResult(result);
            // Update job status
            await this.repository.updateDetectionJob(jobId, {
                status: 'completed'
            });
        }
        catch (error) {
            await this.repository.updateDetectionJob(jobId, {
                status: 'failed'
            });
            throw error;
        }
    }
    /**
     * Get detection job status
     */
    async getDetectionJobStatus(jobId) {
        return await this.repository.getDetectionJob(jobId);
    }
    /**
     * Symbol library management
     */
    async getSymbolLibrary(filters = {}) {
        return await this.repository.getSymbolLibraryEntries(filters.symbolType, filters.symbolCategory);
    }
    /**
     * Validate detected symbol against library
     */
    async validateDetectedSymbol(symbol) {
        try {
            const libraryEntries = await this.repository.getSymbolLibraryEntries(symbol.symbolType, symbol.symbolCategory);
            if (libraryEntries.length === 0) {
                return {
                    isValid: false,
                    confidence: 0,
                    suggestions: ['Consider adding this symbol type to the library']
                };
            }
            // Basic validation logic (can be enhanced with ML)
            const confidence = symbol.confidence * 0.8; // Reduce confidence for validation
            const isValid = confidence > 0.7;
            const suggestions = [];
            if (!isValid) {
                suggestions.push('Low confidence detection - manual review recommended');
                if (libraryEntries.length > 1) {
                    suggestions.push(`Consider alternative symbol types: ${libraryEntries.slice(0, 3).map(e => e.symbolName).join(', ')}`);
                }
            }
            return { isValid, confidence, suggestions };
        }
        catch (error) {
            return {
                isValid: false,
                confidence: 0,
                suggestions: ['Validation failed due to system error']
            };
        }
    }
    /**
     * Delete detection results and clean up associated data
     */
    async deleteDetectionResult(resultId) {
        return await this.repository.deleteDetectionResult(resultId);
    }
    /**
     * Clean up expired cache and old data
     */
    async performCleanup() {
        try {
            const cacheEntriesRemoved = await this.repository.cleanExpiredCache();
            // Could add cleanup of old jobs, metrics, etc.
            const oldJobsRemoved = 0; // Placeholder for future implementation
            return { cacheEntriesRemoved, oldJobsRemoved };
        }
        catch (error) {
            throw new symbol_detection_types_1.SymbolDetectionError('Cleanup operation failed', 'STORAGE_CLEANUP_ERROR', { originalError: error });
        }
    }
    /**
     * Get comprehensive storage statistics
     */
    async getStorageStatistics() {
        // This would require additional queries - placeholder implementation
        return {
            totalDetectionResults: 0,
            totalDetectedSymbols: 0,
            cacheHitRate: 0,
            averageProcessingTime: 0,
            symbolTypeDistribution: {},
            storageUsage: {
                detectionResults: '0 MB',
                cache: '0 MB',
                symbolLibrary: '0 MB'
            }
        };
    }
    /**
     * Shutdown cleanup
     */
    async shutdown() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        await this.performCleanup();
    }
    // Private helper methods
    calculateDocumentHash(buffer) {
        return crypto_1.default.createHash('sha256').update(buffer).digest('hex');
    }
    calculateSettingsHash(settings) {
        const settingsString = JSON.stringify(settings, Object.keys(settings).sort());
        return crypto_1.default.createHash('sha256').update(settingsString).digest('hex');
    }
    async storePerformanceMetrics(detectionResultId, result) {
        const metrics = [
            {
                metricType: 'processing_time',
                metricValue: result.processingTimeMs,
                metricUnit: 'ms'
            },
            {
                metricType: 'symbols_detected',
                metricValue: result.detectedSymbols.length,
                metricUnit: 'count'
            },
            {
                metricType: 'average_confidence',
                metricValue: result.overallConfidence,
                metricUnit: 'percentage'
            },
            {
                metricType: 'image_processing_time',
                metricValue: result.detectionMetadata.imageProcessingTime,
                metricUnit: 'ms'
            },
            {
                metricType: 'pattern_matching_time',
                metricValue: result.detectionMetadata.patternMatchingTime,
                metricUnit: 'ms'
            },
            {
                metricType: 'ml_classification_time',
                metricValue: result.detectionMetadata.mlClassificationTime,
                metricUnit: 'ms'
            }
        ];
        await this.repository.saveDetectionMetrics(detectionResultId, metrics);
    }
    generateSessionSummary(sessionId, results) {
        if (results.length === 0) {
            return {
                sessionId,
                totalDetections: 0,
                totalSymbolsFound: 0,
                averageConfidence: 0,
                processingTimeTotal: 0,
                lastDetectionAt: new Date(),
                symbolTypeCounts: {}
            };
        }
        const totalSymbolsFound = results.reduce((sum, r) => sum + r.detectedSymbols.length, 0);
        const totalConfidence = results.reduce((sum, r) => sum + r.overallConfidence, 0);
        const processingTimeTotal = results.reduce((sum, r) => sum + r.processingTimeMs, 0);
        const symbolTypeCounts = {};
        results.forEach(result => {
            result.detectedSymbols.forEach((symbol) => {
                symbolTypeCounts[symbol.symbolType] = (symbolTypeCounts[symbol.symbolType] || 0) + 1;
            });
        });
        return {
            sessionId,
            totalDetections: results.length,
            totalSymbolsFound,
            averageConfidence: totalConfidence / results.length,
            processingTimeTotal,
            lastDetectionAt: results[0].createdAt, // Results are ordered by created_at DESC
            symbolTypeCounts
        };
    }
    startCleanupScheduler() {
        this.cleanupTimer = setInterval(async () => {
            try {
                await this.performCleanup();
            }
            catch (error) {
                console.warn('Scheduled cleanup failed:', error);
            }
        }, this.config.cleanupIntervalMinutes * 60 * 1000);
    }
}
exports.SymbolDetectionStorageService = SymbolDetectionStorageService;
//# sourceMappingURL=symbol-detection-storage.service.js.map