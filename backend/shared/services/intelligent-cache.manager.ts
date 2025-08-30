import { EventEmitter } from 'events';
import { createClient, RedisClientType } from 'redis';
import { performance } from 'perf_hooks';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';

/**
 * File cache entry with compression and metadata
 */
export interface FileCacheEntry {
  sessionId: string;
  filepath: string;
  content: Buffer;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  mimeType?: string;
  encoding?: BufferEncoding;
  checksum: string;
  cachedAt: number;
  lastAccessed: number;
  accessCount: number;
  ttl: number;
}

/**
 * Cache decision criteria
 */
export interface CacheDecision {
  shouldCache: boolean;
  priority: 'high' | 'medium' | 'low' | 'none';
  reason: string;
  estimatedSize: number;
  compressionSavings: number;
}

/**
 * Access pattern analysis
 */
export interface AccessPattern {
  filepath: string;
  accessCount: number;
  accessFrequency: number; // accesses per hour
  lastAccess: Date;
  averageAccessInterval: number; // milliseconds between accesses
  volatilityScore: number; // how often file changes (0-1)
  popularityScore: number; // normalized popularity (0-1)
}

/**
 * Intelligent cache configuration
 */
export interface IntelligentCacheConfig {
  redisUrl: string;
  maxFileSize: number; // Maximum file size to cache (1MB default)
  minFileSize: number; // Minimum file size to cache (1KB default)
  compressionThreshold: number; // Compress files larger than this
  maxMemoryUsage: number;
  defaultTTL: number;
  accessPatternWindow: number; // Hours to analyze access patterns
  popularityThreshold: number; // Minimum popularity score to cache
  cachePrefix: string;
  healthCheckInterval: number;
}

/**
 * Intelligent file cache manager
 */
export class IntelligentCacheManager extends EventEmitter {
  private redis: RedisClientType;
  private config: IntelligentCacheConfig;
  private accessPatterns: Map<string, AccessPattern> = new Map();
  private gzipCompress: (data: Buffer) => Promise<Buffer>;
  private gzipDecompress: (data: Buffer) => Promise<Buffer>;

  constructor(config: IntelligentCacheConfig) {
    super();
    this.config = config;
    this.gzipCompress = promisify(zlib.gzip);
    this.gzipDecompress = promisify(zlib.gunzip);

    this.initializeRedis();
    this.startHealthMonitoring();
    this.startPatternAnalysis();
  }

  /**
   * Determine if a file should be cached based on intelligent criteria
   */
  async shouldCacheFile(sessionId: string, filepath: string, fileSize: number): Promise<CacheDecision> {
    // Size-based filtering
    if (fileSize > this.config.maxFileSize) {
      return {
        shouldCache: false,
        priority: 'none',
        reason: `File size (${fileSize}) exceeds maximum cache size (${this.config.maxFileSize})`,
        estimatedSize: fileSize,
        compressionSavings: 0,
      };
    }

    if (fileSize < this.config.minFileSize) {
      return {
        shouldCache: false,
        priority: 'none',
        reason: `File size (${fileSize}) below minimum cache size (${this.config.minFileSize})`,
        estimatedSize: fileSize,
        compressionSavings: 0,
      };
    }

    // Analyze access patterns
    const pattern = await this.analyzeAccessPattern(sessionId, filepath);
    const popularityScore = pattern?.popularityScore || 0;

    if (popularityScore < this.config.popularityThreshold) {
      return {
        shouldCache: false,
        priority: 'none',
        reason: `File popularity score (${popularityScore}) below threshold (${this.config.popularityThreshold})`,
        estimatedSize: fileSize,
        compressionSavings: 0,
      };
    }

    // Calculate compression savings
    const compressionSavings = await this.estimateCompressionSavings(fileSize);
    const compressedSize = fileSize - compressionSavings;
    const priority = this.calculateCachePriority(pattern, fileSize, compressedSize);

    return {
      shouldCache: true,
      priority,
      reason: `File meets caching criteria (size: ${fileSize}, popularity: ${popularityScore}, compression: ${compressionSavings} bytes saved)`,
      estimatedSize: compressedSize,
      compressionSavings,
    };
  }

  /**
   * Cache a file with intelligent compression and metadata
   */
  async cacheFile(sessionId: string, filepath: string, content: Buffer): Promise<void> {
    const decision = await this.shouldCacheFile(sessionId, filepath, content.length);

    if (!decision.shouldCache) {
      this.emit('fileNotCached', { sessionId, filepath, reason: decision.reason });
      return;
    }

    try {
      // Compress content if beneficial
      const compressedContent = await this.compressContent(content);
      const checksum = await this.calculateChecksum(content);

      const entry: FileCacheEntry = {
        sessionId,
        filepath,
        content: compressedContent,
        originalSize: content.length,
        compressedSize: compressedContent.length,
        compressionRatio: content.length > 0 ? compressedContent.length / content.length : 1,
        checksum,
        cachedAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 1,
        ttl: this.calculateTTL(decision.priority),
      };

      const cacheKey = this.buildCacheKey(sessionId, filepath);
      await this.setCacheEntry(cacheKey, entry);

      // Update access patterns
      await this.recordAccess(sessionId, filepath);

      this.emit('fileCached', {
        sessionId,
        filepath,
        originalSize: entry.originalSize,
        compressedSize: entry.compressedSize,
        compressionRatio: entry.compressionRatio,
        priority: decision.priority,
      });

    } catch (error) {
      this.emit('cacheError', { sessionId, filepath, error: error as Error });
    }
  }

  /**
   * Retrieve a cached file
   */
  async getCachedFile(sessionId: string, filepath: string): Promise<Buffer | null> {
    const cacheKey = this.buildCacheKey(sessionId, filepath);

    try {
      const data = await this.redis.get(cacheKey);
      if (!data) {
        return null;
      }

      const entry: FileCacheEntry = JSON.parse(data);
      const decompressedContent = await this.decompressContent(entry.content);

      // Update access statistics
      entry.lastAccessed = Date.now();
      entry.accessCount++;
      await this.setCacheEntry(cacheKey, entry);
      await this.recordAccess(sessionId, filepath);

      this.emit('cacheHit', {
        sessionId,
        filepath,
        accessTime: performance.now(),
        compressedSize: entry.compressedSize,
      });

      return decompressedContent;

    } catch (error) {
      this.emit('cacheRetrievalError', { sessionId, filepath, error: error as Error });
      return null;
    }
  }

  /**
   * Preload cache based on predicted access patterns
   */
  async preloadCache(sessionId: string, patterns?: string[]): Promise<void> {
    try {
      const filesToPreload = await this.predictAccessPatterns(sessionId, patterns);

      for (const filepath of filesToPreload) {
        try {
          const fullPath = path.join('/tmp', sessionId, filepath);

          // Check if file exists and get its content
          const stats = await fs.stat(fullPath);
          const decision = await this.shouldCacheFile(sessionId, filepath, stats.size);

          if (decision.shouldCache && decision.priority !== 'none') {
            const content = await fs.readFile(fullPath);
            await this.cacheFile(sessionId, filepath, content);
          }
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }

      this.emit('cachePreloaded', { sessionId, fileCount: filesToPreload.length });

    } catch (error) {
      this.emit('preloadError', { sessionId, error: error as Error });
    }
  }

  /**
   * Validate cache consistency
   */
  async validateCacheConsistency(sessionId: string, filepath: string): Promise<boolean> {
    try {
      const cacheKey = this.buildCacheKey(sessionId, filepath);
      const cachedData = await this.redis.get(cacheKey);

      if (!cachedData) {
        return true; // No cache entry to validate
      }

      const entry: FileCacheEntry = JSON.parse(cachedData);

      // Check if file still exists and hasn't changed
      const fullPath = path.join('/tmp', sessionId, filepath);
      const stats = await fs.stat(fullPath);

      if (stats.size !== entry.originalSize) {
        // File size changed, invalidate cache
        await this.invalidateFile(sessionId, filepath);
        this.emit('cacheInvalidated', { sessionId, filepath, reason: 'file_size_changed' });
        return false;
      }

      // Verify checksum if available
      if (entry.checksum) {
        const content = await fs.readFile(fullPath);
        const currentChecksum = await this.calculateChecksum(content);

        if (currentChecksum !== entry.checksum) {
          // File content changed, invalidate cache
          await this.invalidateFile(sessionId, filepath);
          this.emit('cacheInvalidated', { sessionId, filepath, reason: 'file_content_changed' });
          return false;
        }
      }

      return true;

    } catch (error) {
      // If we can't validate, assume inconsistent and remove cache
      await this.invalidateFile(sessionId, filepath);
      this.emit('cacheInvalidated', { sessionId, filepath, reason: 'validation_error' });
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<any> {
    try {
      const keys = await this.redis.keys(`${this.config.cachePrefix}:*`);
      const stats = {
        totalFiles: keys.length,
        totalSize: 0,
        compressionRatio: 0,
        hitRate: 0,
        popularFiles: [] as Array<{ filepath: string; accessCount: number }>,
      };

      for (const key of keys) {
        const data = await this.redis.get(key);
        if (data) {
          const entry: FileCacheEntry = JSON.parse(data);
          stats.totalSize += entry.compressedSize;
          stats.compressionRatio += entry.compressionRatio;

          stats.popularFiles.push({
            filepath: `${entry.sessionId}:${entry.filepath}`,
            accessCount: entry.accessCount,
          });
        }
      }

      // Calculate averages
      if (stats.totalFiles > 0) {
        stats.compressionRatio /= stats.totalFiles;
      }

      // Sort by popularity
      stats.popularFiles.sort((a, b) => b.accessCount - a.accessCount);
      stats.popularFiles = stats.popularFiles.slice(0, 10); // Top 10

      return stats;

    } catch (error) {
      this.emit('statsError', error);
      return null;
    }
  }

  /**
   * Invalidate a specific file from cache
   */
  async invalidateFile(sessionId: string, filepath: string): Promise<void> {
    const cacheKey = this.buildCacheKey(sessionId, filepath);
    await this.redis.del(cacheKey);
  }

  /**
   * Close cache manager
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
    this.emit('closed');
  }

  /**
   * Analyze access patterns for a file
   */
  private async analyzeAccessPattern(sessionId: string, filepath: string): Promise<AccessPattern | null> {
    const patternKey = `${sessionId}:${filepath}`;

    if (this.accessPatterns.has(patternKey)) {
      return this.accessPatterns.get(patternKey)!;
    }

    // For now, return a default pattern. In production, this would analyze
    // historical access data from Redis or a database
    const pattern: AccessPattern = {
      filepath,
      accessCount: 0,
      accessFrequency: 0,
      lastAccess: new Date(),
      averageAccessInterval: 3600000, // 1 hour default
      volatilityScore: 0.1, // Low volatility default
      popularityScore: 0.5, // Medium popularity default
    };

    this.accessPatterns.set(patternKey, pattern);
    return pattern;
  }

  /**
   * Record file access for pattern analysis
   */
  private async recordAccess(sessionId: string, filepath: string): Promise<void> {
    const patternKey = `${sessionId}:${filepath}`;
    const now = new Date();

    if (!this.accessPatterns.has(patternKey)) {
      this.accessPatterns.set(patternKey, {
        filepath,
        accessCount: 0,
        accessFrequency: 0,
        lastAccess: now,
        averageAccessInterval: 3600000,
        volatilityScore: 0.1,
        popularityScore: 0.5,
      });
    }

    const pattern = this.accessPatterns.get(patternKey)!;
    pattern.accessCount++;
    pattern.lastAccess = now;

    // Update popularity score based on access patterns
    pattern.popularityScore = Math.min(1, pattern.accessCount / 100); // Normalize to 0-1

    // Store pattern in Redis for persistence (simplified)
    const patternKeyRedis = `pattern:${patternKey}`;
    await this.redis.setEx(patternKeyRedis, 86400, JSON.stringify(pattern)); // 24 hours
  }

  /**
   * Estimate compression savings
   */
  private async estimateCompressionSavings(fileSize: number): Promise<number> {
    if (fileSize < this.config.compressionThreshold) {
      return 0; // No compression for small files
    }

    // Estimate based on file type and size
    // Text files compress well, binary files less so
    const compressionRatio = 0.6; // 40% compression estimate
    return Math.floor(fileSize * (1 - compressionRatio));
  }

  /**
   * Compress file content
   */
  private async compressContent(content: Buffer): Promise<Buffer> {
    if (content.length < this.config.compressionThreshold) {
      return content; // Don't compress small files
    }

    try {
      return await this.gzipCompress(content);
    } catch (error) {
      // If compression fails, return original content
      return content;
    }
  }

  /**
   * Decompress file content
   */
  private async decompressContent(content: Buffer): Promise<Buffer> {
    try {
      return await this.gzipDecompress(content);
    } catch (error) {
      // If decompression fails, assume content is uncompressed
      return content;
    }
  }

  /**
   * Calculate file checksum
   */
  private async calculateChecksum(content: Buffer): Promise<string> {
    const crypto = await import('crypto');
    return crypto.default.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Calculate cache priority
   */
  private calculateCachePriority(
    pattern: AccessPattern | null,
    originalSize: number,
    compressedSize: number
  ): 'high' | 'medium' | 'low' {
    let score = 0;

    // Popularity score (0-40 points)
    if (pattern) {
      score += pattern.popularityScore * 40;
    }

    // Size efficiency score (0-30 points)
    const compressionRatio = originalSize > 0 ? compressedSize / originalSize : 1;
    score += (1 - compressionRatio) * 30; // Better compression = higher score

    // Size score (0-30 points) - prefer smaller files
    const sizeScore = Math.max(0, 30 - (originalSize / 1024 / 100)); // Penalty for files > 100KB
    score += sizeScore;

    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
  }

  /**
   * Calculate TTL based on priority
   */
  private calculateTTL(priority: 'high' | 'medium' | 'low'): number {
    const baseTTL = this.config.defaultTTL;

    switch (priority) {
      case 'high': return baseTTL * 4; // 4x longer for high priority
      case 'medium': return baseTTL * 2; // 2x longer for medium priority
      case 'low': return baseTTL; // Base TTL for low priority
      default: return baseTTL;
    }
  }

  /**
   * Predict access patterns for preloading
   */
  private async predictAccessPatterns(sessionId: string, patterns?: string[]): Promise<string[]> {
    const predictions: string[] = [];

    // Get recent access patterns from Redis
    const patternKeys = await this.redis.keys(`pattern:${sessionId}:*`);

    for (const key of patternKeys) {
      const data = await this.redis.get(key);
      if (data) {
        const pattern: AccessPattern = JSON.parse(data);

        // Include files with high popularity scores
        if (pattern.popularityScore > 0.7) {
          predictions.push(pattern.filepath);
        }
      }
    }

    // Include pattern-matched files if specified
    if (patterns) {
      for (const pattern of patterns) {
        try {
          // Simple glob pattern matching (in production, use a proper glob library)
          const files = await this.findFilesByPattern(sessionId, pattern);
          predictions.push(...files);
        } catch (error) {
          // Skip invalid patterns
          continue;
        }
      }
    }

    return predictions.slice(0, 50); // Limit to 50 files for preloading
  }

  /**
   * Find files by pattern (simplified implementation)
   */
  private async findFilesByPattern(sessionId: string, pattern: string): Promise<string[]> {
    // This is a simplified implementation. In production, use a proper glob library
    const sessionPath = path.join('/tmp', sessionId);

    try {
      const files: string[] = [];

      const walkDir = async (dir: string, relativePath: string = '') => {
        const items = await fs.readdir(dir, { withFileTypes: true });

        for (const item of items) {
          const itemPath = path.join(dir, item.name);
          const relativeItemPath = path.join(relativePath, item.name);

          if (item.isDirectory()) {
            await walkDir(itemPath, relativeItemPath);
          } else if (item.isFile()) {
            // Simple pattern matching
            if (this.matchesPattern(relativeItemPath, pattern)) {
              files.push(relativeItemPath);
            }
          }
        }
      };

      await walkDir(sessionPath);
      return files;

    } catch (error) {
      return [];
    }
  }

  /**
   * Simple pattern matching
   */
  private matchesPattern(filepath: string, pattern: string): boolean {
    // Convert glob pattern to regex (simplified)
    const regex = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    return new RegExp(regex).test(filepath);
  }

  /**
   * Set cache entry in Redis
   */
  private async setCacheEntry(key: string, entry: FileCacheEntry): Promise<void> {
    const serialized = JSON.stringify(entry);
    await this.redis.setEx(key, entry.ttl, serialized);
  }

  /**
   * Build cache key
   */
  private buildCacheKey(sessionId: string, filepath: string): string {
    return `${this.config.cachePrefix}:${sessionId}:${filepath}`);
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      this.redis = createClient({ url: this.config.redisUrl });
      await this.redis.connect();
      this.emit('redisConnected');
    } catch (error) {
      this.emit('redisError', error);
      throw error;
    }
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    setInterval(async () => {
      try {
        await this.redis.ping();
        this.emit('healthCheck', { status: 'healthy' });
      } catch (error) {
        this.emit('healthCheck', { status: 'unhealthy', error: error as Error });
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Start pattern analysis routine
   */
  private startPatternAnalysis(): void {
    // Analyze patterns every hour
    setInterval(async () => {
      await this.updateAccessPatterns();
    }, 3600000); // 1 hour
  }

  /**
   * Update access patterns from Redis
   */
  private async updateAccessPatterns(): Promise<void> {
    try {
      const patternKeys = await this.redis.keys('pattern:*');

      for (const key of patternKeys) {
        const data = await this.redis.get(key);
        if (data) {
          const pattern: AccessPattern = JSON.parse(data);
          this.accessPatterns.set(key.replace('pattern:', ''), pattern);
        }
      }

      this.emit('patternsUpdated', { patternCount: this.accessPatterns.size });
    } catch (error) {
      this.emit('patternUpdateError', error);
    }
  }
}

/**
 * Factory function to create IntelligentCacheManager
 */
export function createIntelligentCacheManager(config?: Partial<IntelligentCacheConfig>): IntelligentCacheManager {
  const defaultConfig: IntelligentCacheConfig = {
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    maxFileSize: 1024 * 1024, // 1MB
    minFileSize: 1024, // 1KB
    compressionThreshold: 4096, // 4KB
    maxMemoryUsage: 500 * 1024 * 1024, // 500MB
    defaultTTL: 3600, // 1 hour
    accessPatternWindow: 24, // 24 hours
    popularityThreshold: 0.3, // 30% popularity threshold
    cachePrefix: 'intelligent_cache',
    healthCheckInterval: 30000, // 30 seconds
  };

  return new IntelligentCacheManager({ ...defaultConfig, ...config });
}
