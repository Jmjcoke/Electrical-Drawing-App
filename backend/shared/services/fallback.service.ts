import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { sharedStorageLogger } from './shared-storage.logger';
import { sharedStorageMetrics } from './shared-storage.metrics';
import {
  FallbackServiceConfig,
  FallbackOperationContext,
  FallbackLevel,
  FallbackCacheEntry,
  FallbackResult,
  FallbackStatistics,
  FallbackStrategy,
  defaultFallbackConfig
} from './fallback.types';

/**
 * Advanced Fallback Service for graceful degradation
 * Implements multi-level fallback strategies with read-through caching
 */
export class FallbackService extends EventEmitter {
  private readonly fallbackCache: Map<string, FallbackCacheEntry> = new Map();
  private readonly fallbackHierarchy: Map<string, FallbackLevel[]> = new Map();
  private readonly fallbackStats: Map<string, FallbackStatistics> = new Map();
  private readonly cacheCleanupInterval: NodeJS.Timeout;

  constructor(
    private readonly config: FallbackServiceConfig = defaultFallbackConfig
  ) {
    super();
    this.initializeFallbackService();
  }

  /**
   * Initialize fallback service components
   */
  private initializeFallbackService(): void {
    // Set up periodic cache cleanup
    this.cacheCleanupInterval = setInterval(() => {
      this.cleanupExpiredCacheEntries();
    }, this.config.cacheCleanupInterval);

    // Set up default fallback hierarchies
    this.initializeDefaultFallbackHierarchies();

    sharedStorageLogger.logInfo('Fallback Service initialized', {
      cacheCleanupInterval: this.config.cacheCleanupInterval,
      maxCacheEntries: this.config.maxCacheEntries,
      defaultCacheTTL: this.config.defaultCacheTTL
    });
  }

  /**
   * Initialize default fallback hierarchies for different operation types
   */
  private initializeDefaultFallbackHierarchies(): void {
    // File access fallback hierarchy
    this.fallbackHierarchy.set('file_access', [
      {
        level: 1,
        strategy: 'cache_read_through',
        description: 'Read from distributed cache first',
        timeout: 5000,
        priority: 'high'
      },
      {
        level: 2,
        strategy: 'local_cache_fallback',
        description: 'Fallback to local cache',
        timeout: 2000,
        priority: 'medium'
      },
      {
        level: 3,
        strategy: 'stale_while_revalidate',
        description: 'Serve stale data while revalidating',
        timeout: 10000,
        priority: 'medium'
      },
      {
        level: 4,
        strategy: 'degraded_mode',
        description: 'Provide basic fallback response',
        timeout: 5000,
        priority: 'low'
      }
    ]);

    // Session path access fallback hierarchy
    this.fallbackHierarchy.set('session_path', [
      {
        level: 1,
        strategy: 'cache_read_through',
        description: 'Read from session cache',
        timeout: 3000,
        priority: 'high'
      },
      {
        level: 2,
        strategy: 'alternative_path_resolution',
        description: 'Try alternative path resolution',
        timeout: 2000,
        priority: 'medium'
      },
      {
        level: 3,
        strategy: 'degraded_path_access',
        description: 'Provide degraded path access',
        timeout: 5000,
        priority: 'low'
      }
    ]);

    // Metadata access fallback hierarchy
    this.fallbackHierarchy.set('metadata_access', [
      {
        level: 1,
        strategy: 'cache_read_through',
        description: 'Read from metadata cache',
        timeout: 2000,
        priority: 'high'
      },
      {
        level: 2,
        strategy: 'backup_metadata_store',
        description: 'Fallback to backup metadata store',
        timeout: 5000,
        priority: 'medium'
      },
      {
        level: 3,
        strategy: 'minimal_metadata_response',
        description: 'Provide minimal metadata response',
        timeout: 1000,
        priority: 'low'
      }
    ]);
  }

  /**
   * Execute operation with fallback strategies
   */
  async executeWithFallback<T>(
    operation: () => Promise<T>,
    context: FallbackOperationContext
  ): Promise<FallbackResult<T>> {
    const operationId = this.generateOperationId();
    const startTime = Date.now();

    // Get fallback hierarchy for this operation type
    const hierarchy = this.fallbackHierarchy.get(context.operationType) ||
                     this.fallbackHierarchy.get('file_access')!;

    let lastError: Error | null = null;
    let result: T | null = null;
    let fallbackLevelUsed: number | null = null;
    let executionTime = 0;

    // Try primary operation first
    try {
      sharedStorageLogger.logInfo('Attempting primary operation', {
        operationId,
        operationType: context.operationType,
        correlationId: context.correlationId
      });

      const primaryResult = await this.executeWithTimeout(
        operation,
        this.config.primaryOperationTimeout
      );

      executionTime = Date.now() - startTime;

      // Cache successful result
      if (context.enableCaching) {
        await this.cacheResult(context.cacheKey || operationId, primaryResult, context);
      }

      return {
        success: true,
        data: primaryResult,
        fallbackLevel: null,
        executionTime,
        operationId,
        cached: false
      };

    } catch (error) {
      lastError = error as Error;
      sharedStorageLogger.logInfo('Primary operation failed, attempting fallbacks', {
        operationId,
        operationType: context.operationType,
        error: lastError.message,
        correlationId: context.correlationId,
        event: 'primary_operation_failed'
      });
    }

    // Try fallback levels in order
    for (const level of hierarchy) {
      if (!this.shouldTryFallbackLevel(level, context)) {
        continue;
      }

      try {
        sharedStorageLogger.logInfo('Attempting fallback level', {
          operationId,
          level: level.level,
          strategy: level.strategy,
          operationType: context.operationType,
          correlationId: context.correlationId
        });

        const fallbackStartTime = Date.now();

        const fallbackResult = await this.executeFallbackLevel(
          level,
          context,
          operationId,
          lastError!
        );

        executionTime = Date.now() - startTime;
        fallbackLevelUsed = level.level;

        // Update fallback statistics
        this.updateFallbackStatistics(context.operationType, level.level, true);

        this.emit('fallbackUsed', {
          operationId,
          operationType: context.operationType,
          fallbackLevel: level.level,
          strategy: level.strategy,
          executionTime,
          correlationId: context.correlationId
        });

        return {
          success: true,
          data: fallbackResult,
          fallbackLevel: level.level,
          executionTime,
          operationId,
          cached: level.strategy.includes('cache'),
          degraded: level.priority === 'low'
        };

      } catch (fallbackError) {
        sharedStorageLogger.logInfo('Fallback level failed', {
          operationId,
          level: level.level,
          strategy: level.strategy,
          error: (fallbackError as Error).message,
          correlationId: context.correlationId,
          event: 'fallback_level_failed'
        });

        // Update fallback statistics
        this.updateFallbackStatistics(context.operationType, level.level, false);

        lastError = fallbackError as Error;
        continue;
      }
    }

    // All fallbacks failed
    executionTime = Date.now() - startTime;

    sharedStorageLogger.logError(
      'All fallback strategies failed',
      new Error(`All fallback strategies failed for operation type: ${context.operationType}`),
      undefined,
      undefined,
      undefined,
      context.correlationId
    );

    this.emit('allFallbacksFailed', {
      operationId,
      operationType: context.operationType,
      executionTime,
      lastError: lastError?.message,
      correlationId: context.correlationId
    });

    return {
      success: false,
      error: lastError || new Error('All fallback strategies failed'),
      fallbackLevel: null,
      executionTime,
      operationId,
      cached: false
    };
  }

  /**
   * Execute a specific fallback level
   */
  private async executeFallbackLevel<T>(
    level: FallbackLevel,
    context: FallbackOperationContext,
    operationId: string,
    primaryError: Error
  ): Promise<T> {
    switch (level.strategy) {
      case 'cache_read_through':
        return await this.executeCacheReadThroughFallback(context, operationId);

      case 'local_cache_fallback':
        return await this.executeLocalCacheFallback(context, operationId);

      case 'stale_while_revalidate':
        return await this.executeStaleWhileRevalidateFallback(context, operationId);

      case 'degraded_mode':
        return await this.executeDegradedModeFallback(context, operationId, primaryError);

      case 'alternative_path_resolution':
        return await this.executeAlternativePathResolution(context, operationId);

      case 'degraded_path_access':
        return await this.executeDegradedPathAccess(context, operationId);

      case 'backup_metadata_store':
        return await this.executeBackupMetadataStoreFallback(context, operationId);

      case 'minimal_metadata_response':
        return await this.executeMinimalMetadataResponse(context, operationId);

      default:
        throw new Error(`Unknown fallback strategy: ${level.strategy}`);
    }
  }

  /**
   * Cache read-through fallback strategy
   */
  private async executeCacheReadThroughFallback<T>(
    context: FallbackOperationContext,
    operationId: string
  ): Promise<T> {
    const cacheKey = context.cacheKey || operationId;
    const cachedEntry = this.fallbackCache.get(cacheKey);

    if (cachedEntry && !this.isCacheEntryExpired(cachedEntry)) {
      sharedStorageLogger.logInfo('Serving from fallback cache', {
        operationId,
        cacheKey,
        cacheAge: Date.now() - cachedEntry.timestamp,
        correlationId: context.correlationId
      });

      return cachedEntry.data as T;
    }

    throw new Error('No valid cache entry available for read-through fallback');
  }

  /**
   * Local cache fallback strategy
   */
  private async executeLocalCacheFallback<T>(
    context: FallbackOperationContext,
    operationId: string
  ): Promise<T> {
    // Try to read from local file system cache
    const localCachePath = this.getLocalCachePath(context);
    if (localCachePath) {
      try {
        const cachedData = await fs.readFile(localCachePath, 'utf8');
        const parsedData = JSON.parse(cachedData);

        sharedStorageLogger.logInfo('Serving from local cache fallback', {
          operationId,
          cachePath: localCachePath,
          correlationId: context.correlationId
        });

        return parsedData as T;
      } catch (error) {
        sharedStorageLogger.logInfo('Local cache fallback failed', {
          operationId,
          cachePath: localCachePath,
          error: (error as Error).message,
          correlationId: context.correlationId,
          event: 'local_cache_fallback_failed'
        });
      }
    }

    throw new Error('Local cache fallback not available');
  }

  /**
   * Stale-while-revalidate fallback strategy
   */
  private async executeStaleWhileRevalidateFallback<T>(
    context: FallbackOperationContext,
    operationId: string
  ): Promise<T> {
    const cacheKey = context.cacheKey || operationId;
    const cachedEntry = this.fallbackCache.get(cacheKey);

    if (cachedEntry && cachedEntry.data) {
      // Serve stale data immediately
      sharedStorageLogger.logInfo('Serving stale data while revalidating', {
        operationId,
        cacheKey,
        cacheAge: Date.now() - cachedEntry.timestamp,
        correlationId: context.correlationId
      });

      // Asynchronously try to revalidate in background
      setImmediate(() => {
        this.attemptBackgroundRevalidation(context, operationId);
      });

      return cachedEntry.data as T;
    }

    throw new Error('No stale data available for stale-while-revalidate fallback');
  }

  /**
   * Degraded mode fallback strategy
   */
  private async executeDegradedModeFallback<T>(
    context: FallbackOperationContext,
    operationId: string,
    primaryError: Error
  ): Promise<T> {
    sharedStorageLogger.logInfo('Executing degraded mode fallback', {
      operationId,
      operationType: context.operationType,
      primaryError: primaryError.message,
      correlationId: context.correlationId
    });

    // Provide a minimal, degraded response based on operation type
    switch (context.operationType) {
      case 'file_access':
        return this.getDegradedFileResponse() as T;

      case 'session_path':
        return this.getDegradedPathResponse(context) as T;

      case 'metadata_access':
        return this.getDegradedMetadataResponse() as T;

      default:
        return { degraded: true, message: 'Service temporarily unavailable' } as T;
    }
  }

  /**
   * Alternative path resolution fallback
   */
  private async executeAlternativePathResolution(
    context: FallbackOperationContext,
    operationId: string
  ): Promise<string> {
    const originalPath = context.path;
    if (!originalPath) {
      throw new Error('No path provided for alternative resolution');
    }

    // Try alternative path patterns
    const alternatives = this.generateAlternativePaths(originalPath);

    for (const altPath of alternatives) {
      try {
        await fs.access(altPath);
        sharedStorageLogger.logInfo('Alternative path resolution successful', {
          operationId,
          originalPath,
          alternativePath: altPath,
          correlationId: context.correlationId
        });
        return altPath;
      } catch (error) {
        continue;
      }
    }

    throw new Error('No alternative paths available');
  }

  /**
   * Degraded path access fallback
   */
  private async executeDegradedPathAccess(
    context: FallbackOperationContext,
    operationId: string
  ): Promise<string> {
    // Provide a basic fallback path structure
    const fallbackPath = path.join(
      context.basePath || '/tmp',
      'fallback',
      context.sessionId || 'unknown',
      context.filename || 'fallback.txt'
    );

    sharedStorageLogger.logInfo('Using degraded path access', {
      operationId,
      fallbackPath,
      correlationId: context.correlationId
    });

    return fallbackPath;
  }

  /**
   * Backup metadata store fallback
   */
  private async executeBackupMetadataStoreFallback<T>(
    context: FallbackOperationContext,
    operationId: string
  ): Promise<T> {
    // Try to read from backup metadata location
    const backupPath = this.getBackupMetadataPath(context);
    if (backupPath) {
      try {
        const backupData = await fs.readFile(backupPath, 'utf8');
        const parsedData = JSON.parse(backupData);

        sharedStorageLogger.logInfo('Serving from backup metadata store', {
          operationId,
          backupPath,
          correlationId: context.correlationId
        });

        return parsedData as T;
      } catch (error) {
        sharedStorageLogger.logInfo('Backup metadata store fallback failed', {
          operationId,
          backupPath,
          error: (error as Error).message,
          correlationId: context.correlationId,
          event: 'backup_metadata_fallback_failed'
        });
      }
    }

    throw new Error('Backup metadata store not available');
  }

  /**
   * Minimal metadata response fallback
   */
  private async executeMinimalMetadataResponse(
    context: FallbackOperationContext,
    operationId: string
  ): Promise<any> {
    sharedStorageLogger.logInfo('Providing minimal metadata response', {
      operationId,
      operationType: context.operationType,
      correlationId: context.correlationId
    });

    // Return minimal metadata structure
    return {
      id: context.id || 'unknown',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      size: 0,
      type: 'unknown',
      degraded: true,
      message: 'Metadata temporarily unavailable, using fallback values'
    };
  }

  /**
   * Cache result for future fallback use
   */
  async cacheResult(
    cacheKey: string,
    data: any,
    context: FallbackOperationContext,
    ttl?: number
  ): Promise<void> {
    const cacheEntry: FallbackCacheEntry = {
      key: cacheKey,
      data,
      timestamp: Date.now(),
      ttl: ttl || context.cacheTTL || this.config.defaultCacheTTL,
      operationType: context.operationType,
      correlationId: context.correlationId
    };

    // Check cache size limits
    if (this.fallbackCache.size >= this.config.maxCacheEntries) {
      // Remove oldest entries
      const entries = Array.from(this.fallbackCache.entries());
      entries.sort(([, a], [, b]) => a.timestamp - b.timestamp);

      const toRemove = Math.ceil(this.config.maxCacheEntries * 0.1); // Remove 10%
      for (let i = 0; i < toRemove; i++) {
        this.fallbackCache.delete(entries[i][0]);
      }
    }

    this.fallbackCache.set(cacheKey, cacheEntry);

    sharedStorageLogger.logInfo('Result cached for fallback use', {
      cacheKey,
      operationType: context.operationType,
      cacheSize: this.fallbackCache.size,
      correlationId: context.correlationId
    });
  }

  /**
   * Invalidate cache entry
   */
  invalidateCache(cacheKey: string): boolean {
    const deleted = this.fallbackCache.delete(cacheKey);

    if (deleted) {
      sharedStorageLogger.logInfo('Cache entry invalidated', { cacheKey });
    }

    return deleted;
  }

  /**
   * Clear all cache entries for an operation type
   */
  clearCacheByOperationType(operationType: string): number {
    let cleared = 0;

    for (const [key, entry] of this.fallbackCache.entries()) {
      if (entry.operationType === operationType) {
        this.fallbackCache.delete(key);
        cleared++;
      }
    }

    sharedStorageLogger.logInfo('Cache cleared by operation type', {
      operationType,
      entriesCleared: cleared
    });

    return cleared;
  }

  /**
   * Get fallback statistics
   */
  getFallbackStatistics(operationType?: string): FallbackStatistics | Map<string, FallbackStatistics> {
    if (operationType) {
      return this.fallbackStats.get(operationType) || this.createDefaultStatistics(operationType);
    }

    return new Map(this.fallbackStats);
  }

  /**
   * Update fallback statistics
   */
  private updateFallbackStatistics(operationType: string, level: number, success: boolean): void {
    let stats = this.fallbackStats.get(operationType);
    if (!stats) {
      stats = this.createDefaultStatistics(operationType);
      this.fallbackStats.set(operationType, stats);
    }

    stats.totalFallbacks++;

    if (success) {
      stats.successfulFallbacks++;
      if (!stats.levelUsage.has(level)) {
        stats.levelUsage.set(level, { attempts: 0, successes: 0 });
      }
      stats.levelUsage.get(level)!.successes++;
    }

    if (!stats.levelUsage.has(level)) {
      stats.levelUsage.set(level, { attempts: 0, successes: 0 });
    }
    stats.levelUsage.get(level)!.attempts++;
  }

  /**
   * Background revalidation attempt
   */
  private async attemptBackgroundRevalidation(
    context: FallbackOperationContext,
    operationId: string
  ): Promise<void> {
    try {
      // This would typically call the primary operation again
      // For now, just log that revalidation was attempted
      sharedStorageLogger.logInfo('Background revalidation attempted', {
        operationId,
        operationType: context.operationType,
        correlationId: context.correlationId
      });

      // In a real implementation, you would:
      // 1. Call the primary operation
      // 2. Update the cache with fresh data
      // 3. Emit revalidation success/failure events

    } catch (error) {
      sharedStorageLogger.logInfo('Background revalidation failed', {
        operationId,
        error: (error as Error).message,
        correlationId: context.correlationId,
        event: 'background_revalidation_failed'
      });
    }
  }

  /**
   * Utility methods
   */
  private shouldTryFallbackLevel(level: FallbackLevel, context: FallbackOperationContext): boolean {
    // Check if level is enabled in context
    if (context.disabledFallbackLevels?.includes(level.level)) {
      return false;
    }

    // Check priority requirements
    if (context.minPriority && this.getPriorityWeight(level.priority) < this.getPriorityWeight(context.minPriority)) {
      return false;
    }

    return true;
  }

  private getPriorityWeight(priority: string): number {
    switch (priority) {
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  private isCacheEntryExpired(entry: FallbackCacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private cleanupExpiredCacheEntries(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.fallbackCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.fallbackCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      sharedStorageLogger.logInfo('Expired cache entries cleaned up', { entriesCleaned: cleaned });
    }
  }

  private generateOperationId(): string {
    return `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `fallback_corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlternativePaths(originalPath: string): string[] {
    const dirname = path.dirname(originalPath);
    const basename = path.basename(originalPath);
    const extname = path.extname(basename);
    const nameWithoutExt = path.basename(basename, extname);

    return [
      // Try parent directory
      path.join(path.dirname(dirname), basename),
      // Try with different extensions
      path.join(dirname, `${nameWithoutExt}.bak`),
      path.join(dirname, `${nameWithoutExt}.old`),
      // Try backup directory
      path.join(dirname, 'backup', basename),
      path.join(dirname, '.backup', basename)
    ];
  }

  private getLocalCachePath(context: FallbackOperationContext): string | null {
    if (!context.path) return null;
    return path.join('/tmp', 'fallback-cache', Buffer.from(context.path).toString('base64').replace(/[\/=]/g, '_'));
  }

  private getBackupMetadataPath(context: FallbackOperationContext): string | null {
    if (!context.id) return null;
    return path.join('/tmp', 'backup-metadata', `${context.id}.json`);
  }

  private getDegradedFileResponse(): any {
    return {
      degraded: true,
      message: 'File temporarily unavailable, serving from cache',
      size: 0,
      content: Buffer.from('Service temporarily unavailable'),
      lastModified: new Date().toISOString()
    };
  }

  private getDegradedPathResponse(context: FallbackOperationContext): string {
    return path.join('/tmp', 'fallback', context.sessionId || 'unknown');
  }

  private getDegradedMetadataResponse(): any {
    return {
      id: 'degraded',
      name: 'Service Temporarily Unavailable',
      type: 'degraded',
      size: 0,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      degraded: true,
      message: 'Metadata service temporarily unavailable'
    };
  }

  private createDefaultStatistics(operationType: string): FallbackStatistics {
    return {
      operationType,
      totalFallbacks: 0,
      successfulFallbacks: 0,
      levelUsage: new Map(),
      lastUpdated: Date.now()
    };
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timeout after ${timeout}ms`));
      }, timeout);

      operation()
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timer));
    });
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
    this.fallbackCache.clear();
    this.fallbackStats.clear();
    this.fallbackHierarchy.clear();

    sharedStorageLogger.logInfo('Fallback Service cleanup completed');
  }
}
