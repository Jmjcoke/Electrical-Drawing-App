import { EventEmitter } from 'events';
import { createClient, RedisClientType } from 'redis';
import { performance } from 'perf_hooks';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * File metadata structure
 */
export interface FileMetadata {
  sessionId: string;
  filepath: string;
  size: number;
  mtime: Date;
  ctime: Date;
  isDirectory: boolean;
  permissions?: string;
  hash?: string; // For change detection
  accessCount: number;
  lastAccessed: Date;
  created: Date;
}

/**
 * Cache entry with metadata
 */
export interface MetadataCacheEntry {
  data: FileMetadata;
  cachedAt: number;
  ttl: number;
  size: number;
  hits: number;
  misses: number;
  lastHit: Date;
  compressionRatio?: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  averageAccessTime: number;
  evictionCount: number;
  invalidationCount: number;
  warmingOperations: number;
  memoryUsage: number;
}

/**
 * Cache configuration
 */
export interface MetadataCacheConfig {
  redisUrl: string;
  defaultTTL: number;
  maxMemoryUsage: number;
  maxEntries: number;
  evictionPolicy: 'LRU' | 'LFU' | 'TTL' | 'SIZE';
  compressionThreshold: number;
  warmingBatchSize: number;
  healthCheckInterval: number;
  cachePrefix: string;
}

/**
 * Cache warming request
 */
export interface CacheWarmingRequest {
  sessionId: string;
  patterns?: string[];
  priority?: 'low' | 'medium' | 'high';
  maxFiles?: number;
}

/**
 * Redis-based metadata cache manager
 */
export class MetadataCacheManager extends EventEmitter {
  private redis: RedisClientType;
  private config: MetadataCacheConfig;
  private stats: CacheStats;
  private warmingQueue: CacheWarmingRequest[] = [];
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(config: MetadataCacheConfig) {
    super();
    this.config = config;
    this.stats = {
      totalEntries: 0,
      totalSize: 0,
      hitRate: 0,
      averageAccessTime: 0,
      evictionCount: 0,
      invalidationCount: 0,
      warmingOperations: 0,
      memoryUsage: 0,
    };

    this.initializeRedis();
    this.startHealthMonitoring();
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      this.redis = createClient({ url: this.config.redisUrl });

      this.redis.on('error', (error) => {
        this.emit('redisError', error);
      });

      this.redis.on('connect', () => {
        this.emit('redisConnected');
      });

      await this.redis.connect();
      this.emit('initialized');
    } catch (error) {
      this.emit('initializationError', error);
      throw error;
    }
  }

  /**
   * Get file metadata from cache or filesystem
   */
  async getMetadata(sessionId: string, filepath: string): Promise<FileMetadata | null> {
    const startTime = performance.now();
    const cacheKey = this.buildCacheKey(sessionId, filepath);

    try {
      // Try to get from cache first
      const cachedData = await this.redis.get(cacheKey);

      if (cachedData) {
        const entry: MetadataCacheEntry = JSON.parse(cachedData);
        entry.hits++;
        entry.lastHit = new Date();

        // Update cache entry
        await this.setCacheEntry(cacheKey, entry);

        // Update statistics
        this.updateAccessStats(performance.now() - startTime, true);

        this.emit('cacheHit', { sessionId, filepath, accessTime: performance.now() - startTime });
        return entry.data;
      }

      // Cache miss - get from filesystem
      const metadata = await this.getFileMetadata(sessionId, filepath);

      if (metadata) {
        // Cache the metadata
        await this.setMetadata(sessionId, filepath, metadata);
        this.emit('cacheMiss', { sessionId, filepath, accessTime: performance.now() - startTime });
      }

      this.updateAccessStats(performance.now() - startTime, false);
      return metadata;
    } catch (error) {
      this.emit('metadataError', { sessionId, filepath, error: error as Error });
      return null;
    }
  }

  /**
   * Set file metadata in cache
   */
  async setMetadata(sessionId: string, filepath: string, metadata: FileMetadata): Promise<void> {
    const cacheKey = this.buildCacheKey(sessionId, filepath);

    try {
      const entry: MetadataCacheEntry = {
        data: metadata,
        cachedAt: Date.now(),
        ttl: this.config.defaultTTL,
        size: this.calculateEntrySize(metadata),
        hits: 0,
        misses: 1,
        lastHit: new Date(),
      };

      await this.setCacheEntry(cacheKey, entry);
      this.updateMemoryStats(entry.size);

      this.emit('metadataCached', { sessionId, filepath, size: entry.size });
    } catch (error) {
      this.emit('cacheWriteError', { sessionId, filepath, error: error as Error });
    }
  }

  /**
   * Invalidate cache entries
   */
  async invalidate(sessionId: string, filepath?: string): Promise<void> {
    try {
      if (filepath) {
        // Invalidate specific file
        const cacheKey = this.buildCacheKey(sessionId, filepath);
        await this.redis.del(cacheKey);
        this.stats.invalidationCount++;
        this.emit('cacheInvalidated', { sessionId, filepath });
      } else {
        // Invalidate all files in session
        const pattern = this.buildCacheKey(sessionId, '*');
        const keys = await this.redis.keys(pattern);

        if (keys.length > 0) {
          await this.redis.del(keys);
          this.stats.invalidationCount += keys.length;
          this.emit('sessionInvalidated', { sessionId, fileCount: keys.length });
        }
      }
    } catch (error) {
      this.emit('invalidationError', { sessionId, filepath, error: error as Error });
    }
  }

  /**
   * Warm cache with frequently accessed files
   */
  async warmCache(request: CacheWarmingRequest): Promise<void> {
    this.warmingQueue.push(request);
    this.stats.warmingOperations++;

    try {
      const files = await this.discoverFilesToWarm(request);
      const batchPromises = [];

      for (let i = 0; i < files.length; i += this.config.warmingBatchSize) {
        const batch = files.slice(i, i + this.config.warmingBatchSize);
        batchPromises.push(this.warmBatch(request.sessionId, batch));
      }

      await Promise.all(batchPromises);
      this.emit('cacheWarmed', { sessionId: request.sessionId, fileCount: files.length });
    } catch (error) {
      this.emit('warmingError', { sessionId: request.sessionId, error: error as Error });
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      // Update real-time stats from Redis
      const info = await this.redis.info('memory');
      const memoryMatch = info.match(/used_memory:(\d+)/);
      if (memoryMatch) {
        this.stats.memoryUsage = parseInt(memoryMatch[1]);
      }

      // Count entries
      const keys = await this.redis.keys(`${this.config.cachePrefix}:*`);
      this.stats.totalEntries = keys.length;

      return { ...this.stats };
    } catch (error) {
      this.emit('statsError', error);
      return { ...this.stats };
    }
  }

  /**
   * Clean up expired entries and enforce size limits
   */
  async cleanup(): Promise<void> {
    try {
      await this.evictExpiredEntries();
      await this.enforceSizeLimits();
      this.emit('cleanupCompleted');
    } catch (error) {
      this.emit('cleanupError', error);
    }
  }

  /**
   * Close cache manager and clean up resources
   */
  async close(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    if (this.redis) {
      await this.redis.quit();
    }

    this.emit('closed');
  }

  /**
   * Get file metadata from filesystem
   */
  private async getFileMetadata(sessionId: string, filepath: string): Promise<FileMetadata | null> {
    try {
      // This would be replaced with actual filesystem access logic
      // For now, return mock data
      const stats = await fs.stat(path.join('/tmp', sessionId, filepath));

      return {
        sessionId,
        filepath,
        size: stats.size,
        mtime: stats.mtime,
        ctime: stats.ctime,
        isDirectory: stats.isDirectory(),
        permissions: (stats.mode & parseInt('777', 8)).toString(8),
        hash: await this.calculateFileHash(sessionId, filepath),
        accessCount: 0,
        lastAccessed: new Date(),
        created: stats.birthtime,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Set cache entry with TTL
   */
  private async setCacheEntry(key: string, entry: MetadataCacheEntry): Promise<void> {
    const serialized = JSON.stringify(entry);
    await this.redis.setEx(key, entry.ttl, serialized);
  }

  /**
   * Build cache key
   */
  private buildCacheKey(sessionId: string, filepath: string): string {
    return `${this.config.cachePrefix}:${sessionId}:${filepath}`;
  }

  /**
   * Calculate entry size in bytes
   */
  private calculateEntrySize(metadata: FileMetadata): number {
    return Buffer.byteLength(JSON.stringify(metadata), 'utf8');
  }

  /**
   * Update memory statistics
   */
  private updateMemoryStats(sizeDelta: number): void {
    this.stats.totalSize += sizeDelta;

    // Check if we need to evict
    if (this.stats.totalSize > this.config.maxMemoryUsage) {
      this.emit('memoryPressure', {
        currentSize: this.stats.totalSize,
        maxSize: this.config.maxMemoryUsage
      });
    }
  }

  /**
   * Update access statistics
   */
  private updateAccessStats(accessTime: number, wasHit: boolean): void {
    // Update average access time (simple moving average)
    this.stats.averageAccessTime = (this.stats.averageAccessTime + accessTime) / 2;

    // Update hit rate
    if (wasHit) {
      this.stats.hitRate = (this.stats.hitRate + 1) / 2;
    } else {
      this.stats.hitRate = this.stats.hitRate / 2;
    }
  }

  /**
   * Discover files to warm cache with
   */
  private async discoverFilesToWarm(request: CacheWarmingRequest): Promise<string[]> {
    // This would implement file discovery logic based on access patterns
    // For now, return mock file list
    return [
      'metadata.json',
      'drawing.pdf',
      'components.json',
      'analysis.txt'
    ];
  }

  /**
   * Warm a batch of files
   */
  private async warmBatch(sessionId: string, files: string[]): Promise<void> {
    const promises = files.map(async (filepath) => {
      const metadata = await this.getFileMetadata(sessionId, filepath);
      if (metadata) {
        await this.setMetadata(sessionId, filepath, metadata);
      }
    });

    await Promise.all(promises);
  }

  /**
   * Calculate file hash for change detection
   */
  private async calculateFileHash(sessionId: string, filepath: string): Promise<string> {
    // Simple hash calculation - in production, use crypto.createHash
    const fullPath = path.join('/tmp', sessionId, filepath);
    try {
      const content = await fs.readFile(fullPath);
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        hash = ((hash << 5) - hash + content[i]) & 0xffffffff;
      }
      return Math.abs(hash).toString(16);
    } catch {
      return '';
    }
  }

  /**
   * Evict expired entries
   */
  private async evictExpiredEntries(): Promise<void> {
    // Redis handles TTL automatically, but we can clean up expired entries
    const keys = await this.redis.keys(`${this.config.cachePrefix}:*`);

    for (const key of keys) {
      const ttl = await this.redis.ttl(key);
      if (ttl === -2) { // Key doesn't exist (expired)
        this.stats.evictionCount++;
      }
    }
  }

  /**
   * Enforce size limits by evicting entries
   */
  private async enforceSizeLimits(): Promise<void> {
    if (this.stats.totalEntries <= this.config.maxEntries &&
        this.stats.totalSize <= this.config.maxMemoryUsage) {
      return;
    }

    // Get all entries with their access patterns
    const keys = await this.redis.keys(`${this.config.cachePrefix}:*`);
    const entries: Array<{ key: string; entry: MetadataCacheEntry }> = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        entries.push({ key, entry: JSON.parse(data) });
      }
    }

    // Sort by eviction policy
    switch (this.config.evictionPolicy) {
      case 'LRU':
        entries.sort((a, b) => a.entry.lastHit.getTime() - b.entry.lastHit.getTime());
        break;
      case 'LFU':
        entries.sort((a, b) => a.entry.hits - b.entry.hits);
        break;
      case 'TTL':
        entries.sort((a, b) => (a.entry.cachedAt + a.entry.ttl) - (b.entry.cachedAt + b.entry.ttl));
        break;
      case 'SIZE':
        entries.sort((a, b) => b.entry.size - a.entry.size);
        break;
    }

    // Evict entries until we're under limits
    let evictedCount = 0;
    for (const { key, entry } of entries) {
      if (this.stats.totalEntries <= this.config.maxEntries &&
          this.stats.totalSize <= this.config.maxMemoryUsage) {
        break;
      }

      await this.redis.del(key);
      this.stats.totalSize -= entry.size;
      this.stats.totalEntries--;
      evictedCount++;
    }

    if (evictedCount > 0) {
      this.stats.evictionCount += evictedCount;
      this.emit('entriesEvicted', { count: evictedCount });
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.redis.ping();
        this.emit('healthCheck', { status: 'healthy' });
      } catch (error) {
        this.emit('healthCheck', { status: 'unhealthy', error: error as Error });
      }
    }, this.config.healthCheckInterval);
  }
}

/**
 * Factory function to create MetadataCacheManager
 */
export function createMetadataCacheManager(config?: Partial<MetadataCacheConfig>): MetadataCacheManager {
  const defaultConfig: MetadataCacheConfig = {
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    defaultTTL: 3600, // 1 hour
    maxMemoryUsage: 100 * 1024 * 1024, // 100MB
    maxEntries: 10000,
    evictionPolicy: 'LRU',
    compressionThreshold: 1024, // 1KB
    warmingBatchSize: 10,
    healthCheckInterval: 30000, // 30 seconds
    cachePrefix: 'metadata_cache',
  };

  return new MetadataCacheManager({ ...defaultConfig, ...config });
}
