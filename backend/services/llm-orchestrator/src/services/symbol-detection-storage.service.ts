/**
 * Symbol Detection Storage Service
 * 
 * High-level service for managing symbol detection data storage, caching, and session management
 * Story: 4.1 Symbol Detection Engine  
 * Task: 4.1.4 Database Storage Integration
 */

import { Pool } from 'pg';
import crypto from 'crypto';
import { 
  SymbolDetectionResult, 
  DetectedSymbol, 
  DetectionJob,
  DetectionSettings,
  SymbolDetectionError 
} from '../../../../shared/types/symbol-detection.types';
import { SymbolDetectionRepository, SymbolLibraryEntry } from '../repositories/symbol-detection.repository';

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

export class SymbolDetectionStorageService {
  private repository: SymbolDetectionRepository;
  private config: StorageServiceConfig;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(
    database: Pool,
    config: Partial<StorageServiceConfig> = {}
  ) {
    this.repository = new SymbolDetectionRepository(database);
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
  async storeDetectionResult(
    result: SymbolDetectionResult,
    documentBuffer?: Buffer,
    settings?: DetectionSettings
  ): Promise<{ resultId: string; cached: boolean }> {
    try {
      // Store the detection result in database
      const resultId = await this.repository.saveDetectionResult(result);

      // Cache result if document buffer is provided
      let cached = false;
      if (documentBuffer && settings) {
        const documentHash = this.calculateDocumentHash(documentBuffer);
        const settingsHash = this.calculateSettingsHash(settings);
        const expiresAt = new Date(Date.now() + this.config.cacheExpirationHours * 60 * 60 * 1000);

        await this.repository.cacheDetectionResult(
          documentHash,
          result.pageNumber,
          settingsHash,
          result,
          expiresAt
        );
        cached = true;
      }

      // Store performance metrics if enabled
      if (this.config.enablePerformanceMetrics) {
        await this.storePerformanceMetrics(resultId, result);
      }

      return { resultId, cached };

    } catch (error) {
      throw new SymbolDetectionError(
        'Failed to store detection result',
        'STORAGE_SAVE_ERROR',
        { originalError: error, resultId: result.id }
      );
    }
  }

  /**
   * Retrieve detection result with cache fallback
   */
  async getDetectionResult(resultId: string): Promise<SymbolDetectionResult | null> {
    return await this.repository.getDetectionResult(resultId);
  }

  /**
   * Check cache for existing detection result
   */
  async getCachedDetectionResult(
    documentBuffer: Buffer,
    pageNumber: number,
    settings: DetectionSettings
  ): Promise<SymbolDetectionResult | null> {
    try {
      const documentHash = this.calculateDocumentHash(documentBuffer);
      const settingsHash = this.calculateSettingsHash(settings);

      return await this.repository.getCachedResult(documentHash, pageNumber, settingsHash);

    } catch (error) {
      // Cache errors should not break the main flow
      console.warn('Cache lookup failed:', error);
      return null;
    }
  }

  /**
   * List detection results for a session with comprehensive filtering
   */
  async listSessionDetectionResults(
    sessionId: string,
    options: {
      limit?: number;
      offset?: number;
      minConfidence?: number;
      symbolTypes?: string[];
      dateFrom?: Date;
      dateTo?: Date;
    } = {}
  ): Promise<{
    results: SymbolDetectionResult[];
    total: number;
    summary: SessionDetectionSummary;
  }> {
    try {
      const { limit = 20, offset = 0 } = options;
      
      // Get paginated results
      const { results } = await this.repository.listDetectionResults(sessionId, limit, offset);

      // Apply client-side filters (could be optimized to SQL level)
      let filteredResults = results;

      if (options.minConfidence !== undefined) {
        filteredResults = filteredResults.filter(r => r.overallConfidence >= options.minConfidence!);
      }

      if (options.symbolTypes && options.symbolTypes.length > 0) {
        filteredResults = filteredResults.filter(r => 
          r.detectedSymbols.some((s: DetectedSymbol) => options.symbolTypes!.includes(s.symbolType))
        );
      }

      if (options.dateFrom) {
        filteredResults = filteredResults.filter(r => r.createdAt >= options.dateFrom!);
      }

      if (options.dateTo) {
        filteredResults = filteredResults.filter(r => r.createdAt <= options.dateTo!);
      }

      // Generate session summary
      const summary = this.generateSessionSummary(sessionId, results);

      return {
        results: filteredResults,
        total: filteredResults.length,
        summary
      };

    } catch (error) {
      throw new SymbolDetectionError(
        'Failed to list session detection results',
        'STORAGE_LIST_ERROR',
        { originalError: error, sessionId }
      );
    }
  }

  /**
   * Detection job lifecycle management
   */
  async createDetectionJob(
    documentId: string,
    sessionId: string,
    pageNumber: number,
    settings: DetectionSettings,
    imageBuffer: Buffer
  ): Promise<string> {
    const jobId = crypto.randomUUID();
    
    const job: DetectionJob = {
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
  async updateJobProgress(
    jobId: string,
    status: DetectionJob['status'],
    progressStage?: string,
    progressPercent?: number
  ): Promise<void> {
    await this.repository.updateDetectionJob(jobId, {
      status,
      progressStage,
      progressPercent
    });
  }

  /**
   * Complete detection job with result
   */
  async completeDetectionJob(
    jobId: string,
    result: SymbolDetectionResult
  ): Promise<void> {
    try {
      // Store the detection result
      await this.repository.saveDetectionResult(result);

      // Update job status
      await this.repository.updateDetectionJob(jobId, {
        status: 'completed'
      });

    } catch (error) {
      await this.repository.updateDetectionJob(jobId, {
        status: 'failed'
      });
      throw error;
    }
  }

  /**
   * Get detection job status
   */
  async getDetectionJobStatus(jobId: string): Promise<DetectionJob | null> {
    return await this.repository.getDetectionJob(jobId);
  }

  /**
   * Symbol library management
   */
  async getSymbolLibrary(
    filters: {
      symbolType?: string;
      symbolCategory?: string;
    } = {}
  ): Promise<SymbolLibraryEntry[]> {
    return await this.repository.getSymbolLibraryEntries(
      filters.symbolType,
      filters.symbolCategory
    );
  }

  /**
   * Validate detected symbol against library
   */
  async validateDetectedSymbol(
    symbol: DetectedSymbol
  ): Promise<{ isValid: boolean; confidence: number; suggestions: string[] }> {
    try {
      const libraryEntries = await this.repository.getSymbolLibraryEntries(
        symbol.symbolType,
        symbol.symbolCategory
      );

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
      
      const suggestions: string[] = [];
      if (!isValid) {
        suggestions.push('Low confidence detection - manual review recommended');
        if (libraryEntries.length > 1) {
          suggestions.push(`Consider alternative symbol types: ${libraryEntries.slice(0, 3).map(e => e.symbolName).join(', ')}`);
        }
      }

      return { isValid, confidence, suggestions };

    } catch (error) {
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
  async deleteDetectionResult(resultId: string): Promise<boolean> {
    return await this.repository.deleteDetectionResult(resultId);
  }

  /**
   * Clean up expired cache and old data
   */
  async performCleanup(): Promise<{
    cacheEntriesRemoved: number;
    oldJobsRemoved: number;
  }> {
    try {
      const cacheEntriesRemoved = await this.repository.cleanExpiredCache();
      
      // Could add cleanup of old jobs, metrics, etc.
      const oldJobsRemoved = 0; // Placeholder for future implementation

      return { cacheEntriesRemoved, oldJobsRemoved };

    } catch (error) {
      throw new SymbolDetectionError(
        'Cleanup operation failed',
        'STORAGE_CLEANUP_ERROR',
        { originalError: error }
      );
    }
  }

  /**
   * Get comprehensive storage statistics
   */
  async getStorageStatistics(): Promise<{
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
  }> {
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
  async shutdown(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    await this.performCleanup();
  }

  // Private helper methods

  private calculateDocumentHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private calculateSettingsHash(settings: DetectionSettings): string {
    const settingsString = JSON.stringify(settings, Object.keys(settings).sort());
    return crypto.createHash('sha256').update(settingsString).digest('hex');
  }

  private async storePerformanceMetrics(
    detectionResultId: string,
    result: SymbolDetectionResult
  ): Promise<void> {
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

  private generateSessionSummary(
    sessionId: string,
    results: SymbolDetectionResult[]
  ): SessionDetectionSummary {
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
    
    const symbolTypeCounts: Record<string, number> = {};
    results.forEach(result => {
      result.detectedSymbols.forEach((symbol: DetectedSymbol) => {
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

  private startCleanupScheduler(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.performCleanup();
      } catch (error) {
        console.warn('Scheduled cleanup failed:', error);
      }
    }, this.config.cleanupIntervalMinutes * 60 * 1000);
  }
}