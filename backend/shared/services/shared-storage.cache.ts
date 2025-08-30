import { sharedStorageLogger } from './shared-storage.logger';
import { sharedStorageMetrics } from './shared-storage.metrics';
import * as fs from 'fs/promises';
import * as path from 'path';
import { performance } from 'perf_hooks';

/**
 * SharedStorageCache provides intelligent caching for shared storage operations
 * Implements file content caching, metadata caching, and access pattern optimization
 */
export class SharedStorageCache {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private metadataCache: Map<string, MetadataCacheEntry> = new Map();
  private accessPatterns: Map<string, AccessPattern> = new Map();
  private readonly maxCacheSize: number;
  private readonly cacheTTL: number; // Time to live in milliseconds
  private readonly maxMetadataCacheSize: number;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    options: {
      maxCacheSize?: number; // Max cache size in bytes (default: 100MB)
      cacheTTL?: number; // Cache TTL in milliseconds (default: 5 minutes)
      maxMetadataCacheSize?: number; // Max metadata entries (default: 1000)
      enableCleanup?: boolean; // Enable automatic cleanup (default: true)
    } = {}
  ) {
    this.maxCacheSize = options.maxCacheSize || 100 * 1024 * 1024; // 100MB
    this.cacheTTL = options.cacheTTL || 5 * 60 * 1000; // 5 minutes
    this.maxMetadataCacheSize = options.maxMetadataCacheSize || 1000;

    if (options.enableCleanup !== false) {
      this.startCleanupInterval();
    }

    sharedStorageLogger.logInfo('Shared storage cache initialized', {
      maxCacheSize: this.maxCacheSize,
      cacheTTL: this.cacheTTL,
      maxMetadataCacheSize: this.maxMetadataCacheSize
    });
  }

  /**
   * Get cached file content
   */
  async getCachedFile(sessionId: string, filepath: string, service: string): Promise<Buffer | null> {
    const cacheKey = this.generateCacheKey(sessionId, filepath);
    const entry = this.memoryCache.get(cacheKey);

    if (!entry) {
      this.recordCacheMiss(cacheKey, 'file_content', service);
      return null;
    }

    // Check if cache entry is still valid
    if (this.isExpired(entry)) {
      this.memoryCache.delete(cacheKey);
      this.recordCacheMiss(cacheKey, 'file_content_expired', service);
      return null;
    }

    // Update access pattern
    this.updateAccessPattern(cacheKey, service);

    // Record cache hit
    this.recordCacheHit(cacheKey, 'file_content', service);

    sharedStorageLogger.logInfo('Cache hit for file content', {
      cacheKey,
      sessionId,
      filepath,
      service,
      cacheAge: Date.now() - entry.cachedAt
    });

    return entry.data as Buffer;
  }

  /**
   * Cache file content
   */
  async cacheFile(sessionId: string, filepath: string, content: Buffer, service: string): Promise<void> {
    const cacheKey = this.generateCacheKey(sessionId, filepath);
    const entrySize = content.length;

    // Check if we have space for this entry
    if (!this.hasSpaceForEntry(entrySize)) {
      this.evictEntries(entrySize);
    }

    const entry: CacheEntry = {
      key: cacheKey,
      data: content,
      size: entrySize,
      cachedAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 0,
      service,
      type: 'file_content'
    };

    this.memoryCache.set(cacheKey, entry);

    sharedStorageLogger.logInfo('File content cached', {
      cacheKey,
      sessionId,
      filepath,
      service,
      size: entrySize
    });
  }

  /**
   * Get cached file metadata
   */
  async getCachedMetadata(sessionId: string, filepath: string, service: string): Promise<MetadataCacheEntry | null> {
    const cacheKey = this.generateMetadataKey(sessionId, filepath);
    const entry = this.metadataCache.get(cacheKey);

    if (!entry) {
      this.recordCacheMiss(cacheKey, 'metadata', service);
      return null;
    }

    // Check if metadata is still valid
    if (this.isExpired(entry)) {
      this.metadataCache.delete(cacheKey);
      this.recordCacheMiss(cacheKey, 'metadata_expired', service);
      return null;
    }

    // Update access pattern
    this.updateAccessPattern(cacheKey, service);

    // Record cache hit
    this.recordCacheHit(cacheKey, 'metadata', service);

    return entry;
  }

  /**
   * Cache file metadata
   */
  async cacheMetadata(
    sessionId: string,
    filepath: string,
    metadata: {
      size: number;
      mtime: Date;
      ctime: Date;
      isDirectory: boolean;
      permissions?: string;
    },
    service: string
  ): Promise<void> {
    const cacheKey = this.generateMetadataKey(sessionId, filepath);

    const entry: MetadataCacheEntry = {
      key: cacheKey,
      sessionId,
      filepath,
      metadata,
      cachedAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 0,
      service,
      type: 'metadata'
    };

    // Check metadata cache size limit
    if (this.metadataCache.size >= this.maxMetadataCacheSize) {
      this.evictOldestMetadataEntry();
    }

    this.metadataCache.set(cacheKey, entry);

    sharedStorageLogger.logInfo('File metadata cached', {
      cacheKey,
      sessionId,
      filepath,
      service,
      size: metadata.size
    });
  }

  /**
   * Invalidate cache entries for a session
   */
  invalidateSessionCache(sessionId: string): void {
    const invalidatedKeys: string[] = [];

    // Invalidate file content cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (key.startsWith(`${sessionId}_`)) {
        this.memoryCache.delete(key);
        invalidatedKeys.push(key);
      }
    }

    // Invalidate metadata cache
    for (const [key, entry] of this.metadataCache.entries()) {
      if (entry.sessionId === sessionId) {
        this.metadataCache.delete(key);
        invalidatedKeys.push(key);
      }
    }

    if (invalidatedKeys.length > 0) {
      sharedStorageLogger.logInfo('Session cache invalidated', {
        sessionId,
        invalidatedKeys: invalidatedKeys.length,
        keys: invalidatedKeys.slice(0, 5) // Log first 5 keys
      });
    }
  }

  /**
   * Invalidate cache entry for a specific file
   */
  invalidateFileCache(sessionId: string, filepath: string): void {
    const fileKey = this.generateCacheKey(sessionId, filepath);
    const metadataKey = this.generateMetadataKey(sessionId, filepath);

    let invalidated = false;

    if (this.memoryCache.has(fileKey)) {
      this.memoryCache.delete(fileKey);
      invalidated = true;
    }

    if (this.metadataCache.has(metadataKey)) {
      this.metadataCache.delete(metadataKey);
      invalidated = true;
    }

    if (invalidated) {
      sharedStorageLogger.logInfo('File cache invalidated', {
        sessionId,
        filepath,
        fileKey,
        metadataKey
      });
    }
  }

  /**
   * Get cache performance statistics
   */
  getCacheStats(): CacheStats {
    const totalEntries = this.memoryCache.size;
    const totalMetadataEntries = this.metadataCache.size;
    const totalSize = Array.from(this.memoryCache.values()).reduce((sum, entry) => sum + entry.size, 0);

    // Calculate hit rates
    const fileContentStats = this.calculateHitRate('file_content');
    const metadataStats = this.calculateHitRate('metadata');

    // Find most accessed entries
    const mostAccessed = Array.from(this.memoryCache.values())
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 5)
      .map(entry => ({
        key: entry.key,
        accessCount: entry.accessCount,
        size: entry.size,
        service: entry.service
      }));

    return {
      totalEntries,
      totalMetadataEntries,
      totalSize,
      maxCacheSize: this.maxCacheSize,
      utilizationPercent: (totalSize / this.maxCacheSize) * 100,
      fileContentCache: fileContentStats,
      metadataCache: metadataStats,
      mostAccessedEntries: mostAccessed,
      cacheTTL: this.cacheTTL,
      lastCleanup: new Date()
    };
  }

  /**
   * Analyze access patterns for optimization recommendations
   */
  analyzeAccessPatterns(): AccessPatternAnalysis {
    const patterns = Array.from(this.accessPatterns.values());
    const frequentAccessFiles = patterns
      .filter(p => p.accessCount > 5) // Files accessed more than 5 times
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 10);

    const sequentialAccessPatterns = patterns.filter(p =>
      p.sequentialAccessCount > p.totalAccessCount * 0.6 // 60% sequential access
    );

    const recommendations = this.generateCacheRecommendations(frequentAccessFiles, sequentialAccessPatterns);

    return {
      frequentAccessFiles,
      sequentialAccessPatterns,
      recommendations,
      analysisTimestamp: new Date()
    };
  }

  /**
   * Preload frequently accessed files into cache
   */
  async preloadFrequentFiles(sessionId: string, basePath: string, service: string): Promise<void> {
    const patterns = Array.from(this.accessPatterns.values())
      .filter(p => p.service === service && p.accessCount > 3)
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 5); // Top 5 most accessed files

    for (const pattern of patterns) {
      try {
        const fullPath = path.join(basePath, sessionId, pattern.filepath);
        const content = await fs.readFile(fullPath);
        await this.cacheFile(sessionId, pattern.filepath, content, service);

        sharedStorageLogger.logInfo('Preloaded frequently accessed file', {
          sessionId,
          filepath: pattern.filepath,
          service,
          size: content.length
        });
      } catch (error) {
        sharedStorageLogger.logError('Failed to preload file', error as Error, sessionId, service, pattern.filepath);
      }
    }
  }

  /**
   * Optimize cache based on access patterns
   */
  optimizeCache(): void {
    const analysis = this.analyzeAccessPatterns();

    // Implement cache optimization strategies
    if (analysis.frequentAccessFiles.length > 0) {
      sharedStorageLogger.logInfo('Cache optimization recommendations', {
        frequentFiles: analysis.frequentAccessFiles.length,
        sequentialPatterns: analysis.sequentialAccessPatterns.length,
        recommendations: analysis.recommendations
      });
    }

    // Evict least recently used entries if cache is near capacity
    const utilizationPercent = (this.getCurrentCacheSize() / this.maxCacheSize) * 100;
    if (utilizationPercent > 80) {
      this.evictLRUEntries();
    }
  }

  /**
   * Private helper methods
   */
  private generateCacheKey(sessionId: string, filepath: string): string {
    return `${sessionId}_${filepath.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  private generateMetadataKey(sessionId: string, filepath: string): string {
    return `metadata_${sessionId}_${filepath.replace(/[^a-zA-Z0-9]/g, '_')}`;
  }

  private isExpired(entry: CacheEntry | MetadataCacheEntry): boolean {
    return Date.now() - entry.cachedAt > this.cacheTTL;
  }

  private hasSpaceForEntry(entrySize: number): boolean {
    const currentSize = this.getCurrentCacheSize();
    return currentSize + entrySize <= this.maxCacheSize;
  }

  private getCurrentCacheSize(): number {
    return Array.from(this.memoryCache.values()).reduce((sum, entry) => sum + entry.size, 0);
  }

  private evictEntries(requiredSize: number): void {
    // Sort entries by last accessed time (oldest first)
    const entries = Array.from(this.memoryCache.values())
      .sort((a, b) => a.lastAccessed - b.lastAccessed);

    let freedSize = 0;
    const evictedKeys: string[] = [];

    for (const entry of entries) {
      if (freedSize >= requiredSize) break;

      this.memoryCache.delete(entry.key);
      freedSize += entry.size;
      evictedKeys.push(entry.key);
    }

    if (evictedKeys.length > 0) {
      sharedStorageLogger.logInfo('Cache entries evicted', {
        evictedCount: evictedKeys.length,
        freedSize,
        requiredSize
      });
    }
  }

  private evictLRUEntries(): void {
    // Evict 20% of least recently used entries
    const entriesToEvict = Math.max(1, Math.floor(this.memoryCache.size * 0.2));
    const entries = Array.from(this.memoryCache.values())
      .sort((a, b) => a.lastAccessed - b.lastAccessed)
      .slice(0, entriesToEvict);

    let freedSize = 0;
    for (const entry of entries) {
      this.memoryCache.delete(entry.key);
      freedSize += entry.size;
    }

    sharedStorageLogger.logInfo('LRU cache eviction completed', {
      evictedCount: entriesToEvict,
      freedSize
    });
  }

  private evictOldestMetadataEntry(): void {
    const oldestEntry = Array.from(this.metadataCache.values())
      .sort((a, b) => a.lastAccessed - b.lastAccessed)[0];

    if (oldestEntry) {
      this.metadataCache.delete(oldestEntry.key);
    }
  }

  private updateAccessPattern(cacheKey: string, service: string): void {
    const pattern = this.accessPatterns.get(cacheKey);
    if (pattern) {
      pattern.accessCount++;
      pattern.lastAccessed = Date.now();
    }
  }

  private recordCacheHit(cacheKey: string, cacheType: string, service: string): void {
    const entry = this.memoryCache.get(cacheKey) || this.metadataCache.get(cacheKey);
    if (entry) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
    }

    sharedStorageMetrics.recordCacheHit(cacheType, service);
  }

  private recordCacheMiss(cacheKey: string, cacheType: string, service: string): void {
    sharedStorageMetrics.recordCacheMiss(cacheType, service);
  }

  private calculateHitRate(cacheType: string): CacheHitRateStats {
    // This would require tracking hit/miss counts per cache type
    // For now, return placeholder stats
    return {
      hitCount: 0,
      missCount: 0,
      hitRate: 0,
      avgResponseTime: 0
    };
  }

  private generateCacheRecommendations(
    frequentFiles: AccessPattern[],
    sequentialPatterns: AccessPattern[]
  ): string[] {
    const recommendations: string[] = [];

    if (frequentFiles.length > 0) {
      recommendations.push(`Consider increasing cache TTL for ${frequentFiles.length} frequently accessed files`);
    }

    if (sequentialPatterns.length > 0) {
      recommendations.push(`Implement read-ahead caching for ${sequentialPatterns.length} sequential access patterns`);
    }

    if (this.getCurrentCacheSize() > this.maxCacheSize * 0.8) {
      recommendations.push('Consider increasing maxCacheSize or implementing cache compression');
    }

    return recommendations;
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.cacheTTL / 4); // Cleanup every quarter of TTL
  }

  private performCleanup(): void {
    const now = Date.now();
    let expiredCount = 0;
    let cleanedSize = 0;

    // Clean expired memory cache entries
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.cachedAt > this.cacheTTL) {
        this.memoryCache.delete(key);
        expiredCount++;
        cleanedSize += entry.size;
      }
    }

    // Clean expired metadata cache entries
    for (const [key, entry] of this.metadataCache.entries()) {
      if (now - entry.cachedAt > this.cacheTTL) {
        this.metadataCache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      sharedStorageLogger.logInfo('Cache cleanup completed', {
        expiredEntries: expiredCount,
        cleanedSize,
        remainingEntries: this.memoryCache.size + this.metadataCache.size
      });
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    this.memoryCache.clear();
    this.metadataCache.clear();
    this.accessPatterns.clear();

    sharedStorageLogger.logInfo('Cache cleanup completed');
  }
}

/**
 * Cache entry interface
 */
export interface CacheEntry {
  key: string;
  data: Buffer | any;
  size: number;
  cachedAt: number;
  lastAccessed: number;
  accessCount: number;
  service: string;
  type: 'file_content' | 'metadata';
}

/**
 * Metadata cache entry
 */
export interface MetadataCacheEntry extends CacheEntry {
  sessionId: string;
  filepath: string;
  metadata: {
    size: number;
    mtime: Date;
    ctime: Date;
    isDirectory: boolean;
    permissions?: string;
  };
}

/**
 * Access pattern tracking
 */
export interface AccessPattern {
  key: string;
  filepath: string;
  service: string;
  accessCount: number;
  lastAccessed: number;
  sequentialAccessCount: number;
  totalAccessCount: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  totalEntries: number;
  totalMetadataEntries: number;
  totalSize: number;
  maxCacheSize: number;
  utilizationPercent: number;
  fileContentCache: CacheHitRateStats;
  metadataCache: CacheHitRateStats;
  mostAccessedEntries: Array<{
    key: string;
    accessCount: number;
    size: number;
    service: string;
  }>;
  cacheTTL: number;
  lastCleanup: Date;
}

/**
 * Cache hit rate statistics
 */
export interface CacheHitRateStats {
  hitCount: number;
  missCount: number;
  hitRate: number;
  avgResponseTime: number;
}

/**
 * Access pattern analysis
 */
export interface AccessPatternAnalysis {
  frequentAccessFiles: AccessPattern[];
  sequentialAccessPatterns: AccessPattern[];
  recommendations: string[];
  analysisTimestamp: Date;
}

// Export factory function
export const createSharedStorageCache = (options?: {
  maxCacheSize?: number;
  cacheTTL?: number;
  maxMetadataCacheSize?: number;
  enableCleanup?: boolean;
}) => {
  return new SharedStorageCache(options);
};
