import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Readable, Writable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { createClient, RedisClientType } from 'redis';
import v8 from 'v8';

/**
 * Memory pressure levels
 */
export enum MemoryPressureLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Stream processing options
 */
export interface StreamProcessingOptions {
  chunkSize?: number;
  maxMemoryUsage?: number;
  compressionLevel?: number;
  enableChecksum?: boolean;
  priority?: 'low' | 'normal' | 'high';
}

/**
 * Memory usage statistics
 */
export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  pressureLevel: MemoryPressureLevel;
  cacheSize: number;
  activeStreams: number;
  garbageCollectionStats?: {
    collections: number;
    totalTime: number;
    averageTime: number;
  };
}

/**
 * Stream session information
 */
export interface StreamSession {
  id: string;
  filepath: string;
  sessionId: string;
  service: string;
  size: number;
  processed: number;
  startTime: number;
  lastActivity: number;
  checksum?: string;
  compressionRatio?: number;
}

/**
 * Memory leak detection result
 */
export interface MemoryLeakAnalysis {
  detected: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendations: string[];
  growthRate: number; // MB per hour
  timeWindow: number; // hours
}

/**
 * Garbage collection optimization result
 */
export interface GCResult {
  collectionsPerformed: number;
  memoryFreed: number;
  timeSpent: number;
  efficiency: number;
  recommendations: string[];
}

/**
 * Memory manager configuration
 */
export interface MemoryManagerConfig {
  redisUrl: string;
  maxHeapSize: number; // Maximum heap size before triggering GC
  memoryPressureThresholds: {
    medium: number; // 70% of max heap
    high: number; // 85% of max heap
    critical: number; // 95% of max heap
  };
  streamChunkSize: number; // Default chunk size for streaming
  maxConcurrentStreams: number; // Maximum concurrent streams
  gcInterval: number; // GC check interval in seconds
  memoryCheckInterval: number; // Memory monitoring interval in seconds
  leakDetectionWindow: number; // Hours to analyze for memory leaks
  cacheEvictionBatchSize: number; // Number of cache entries to evict at once
  enableCompression: boolean;
  compressionThreshold: number; // File size threshold for compression
}

/**
 * Memory-efficient file streaming manager
 */
export class MemoryManager extends EventEmitter {
  private redis: RedisClientType | null = null;
  private config: MemoryManagerConfig;
  private activeStreams: Map<string, StreamSession> = new Map();
  private memoryHistory: Array<{ timestamp: number; stats: MemoryStats }> = [];
  private gcStats: { collections: number; totalTime: number; lastGC: number } = {
    collections: 0,
    totalTime: 0,
    lastGC: 0,
  };
  private memoryCheckTimer: NodeJS.Timeout | null = null;
  private gcTimer: NodeJS.Timeout | null = null;

  constructor(config: MemoryManagerConfig) {
    super();
    this.config = config;
    this.initializeRedis();
    this.startMemoryMonitoring();
    this.startGCMonitoring();
  }

  /**
   * Initialize Redis connection for persistent state
   */
  private async initializeRedis(): Promise<void> {
    if (!this.config.redisUrl) return;

    try {
      this.redis = createClient({ url: this.config.redisUrl });
      await this.redis.connect();
      this.emit('redisConnected');
    } catch (error) {
      this.emit('redisError', error);
      this.redis = null;
    }
  }

  /**
   * Create a memory-efficient stream for reading large files
   */
  async createReadStream(
    sessionId: string,
    filepath: string,
    service: string,
    options: StreamProcessingOptions = {}
  ): Promise<Readable> {
    const fullPath = path.join('/tmp', sessionId, filepath);
    const stats = await fs.stat(fullPath);

    // Check memory pressure before starting stream
    const pressureLevel = await this.getMemoryPressureLevel();
    if (pressureLevel === MemoryPressureLevel.CRITICAL) {
      throw new Error('Memory pressure too high for new stream operations');
    }

    // Check concurrent stream limits
    if (this.activeStreams.size >= this.config.maxConcurrentStreams) {
      throw new Error('Maximum concurrent streams limit reached');
    }

    const session: StreamSession = {
      id: crypto.randomUUID(),
      filepath,
      sessionId,
      service,
      size: stats.size,
      processed: 0,
      startTime: performance.now(),
      lastActivity: Date.now(),
    };

    this.activeStreams.set(session.id, session);

    const chunkSize = options.chunkSize || this.config.streamChunkSize;
    let processedBytes = 0;

    const readableStream = new Readable({
      objectMode: false,
      read(size) {
        // This will be implemented by the pipeline
      },
      destroy(error, callback) {
        // Cleanup on destroy
        this.activeStreams.delete(session.id);
        callback(error);
      },
    });

    // Create file read stream with controlled chunking
    const fileStream = fs.createReadStream(fullPath, {
      highWaterMark: chunkSize,
    });

    // Transform stream for memory-efficient processing
    const transformStream = new Transform({
      objectMode: false,
      transform(chunk, encoding, callback) {
        processedBytes += chunk.length;
        session.processed = processedBytes;
        session.lastActivity = Date.now();

        // Memory pressure check during processing
        if (processedBytes % (chunkSize * 10) === 0) { // Check every 10 chunks
          this.checkMemoryPressure();
        }

        callback(null, chunk);
      },
    });

    // Compression stream if enabled and beneficial
    let compressionStream: Transform | null = null;
    if (this.config.enableCompression && stats.size > this.config.compressionThreshold) {
      compressionStream = zlib.createGzip({
        level: options.compressionLevel || 6,
      });
      session.compressionRatio = 0; // Will be calculated after completion
    }

    // Checksum calculation if enabled
    let checksumStream: Transform | null = null;
    if (options.enableChecksum) {
      const hash = crypto.createHash('sha256');
      checksumStream = new Transform({
        transform(chunk, encoding, callback) {
          hash.update(chunk);
          callback(null, chunk);
        },
        flush(callback) {
          session.checksum = hash.digest('hex');
          callback();
        },
      });
    }

    // Build pipeline based on options
    const streams: (Readable | Writable | Transform)[] = [fileStream, transformStream];

    if (compressionStream) streams.push(compressionStream);
    if (checksumStream) streams.push(checksumStream);

    // Connect to readable stream
    let currentStream: Readable = fileStream;

    if (compressionStream) {
      fileStream.pipe(transformStream).pipe(compressionStream);
      currentStream = compressionStream;
    } else if (checksumStream) {
      fileStream.pipe(transformStream).pipe(checksumStream);
      currentStream = checksumStream;
    } else {
      fileStream.pipe(transformStream);
      currentStream = transformStream;
    }

    // Forward data to our readable stream
    currentStream.on('data', (chunk) => {
      if (!readableStream.push(chunk)) {
        // Backpressure handling
        currentStream.pause();
        readableStream.once('drain', () => currentStream.resume());
      }
    });

    currentStream.on('end', () => {
      readableStream.push(null); // End the readable stream

      // Calculate compression ratio if compression was used
      if (compressionStream && session.processed > 0) {
        session.compressionRatio = processedBytes / session.size;
      }

      // Emit completion event
      this.emit('streamCompleted', session);
    });

    currentStream.on('error', (error) => {
      readableStream.destroy(error);
      this.emit('streamError', { session, error });
    });

    // Handle stream cleanup
    readableStream.on('close', () => {
      this.activeStreams.delete(session.id);
    });

    this.emit('streamStarted', session);
    return readableStream;
  }

  /**
   * Create a memory-efficient stream for writing large files
   */
  async createWriteStream(
    sessionId: string,
    filepath: string,
    service: string,
    options: StreamProcessingOptions = {}
  ): Promise<Writable> {
    const fullPath = path.join('/tmp', sessionId, filepath);

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Check memory pressure
    const pressureLevel = await this.getMemoryPressureLevel();
    if (pressureLevel === MemoryPressureLevel.CRITICAL) {
      throw new Error('Memory pressure too high for new stream operations');
    }

    // Check concurrent stream limits
    if (this.activeStreams.size >= this.config.maxConcurrentStreams) {
      throw new Error('Maximum concurrent streams limit reached');
    }

    const session: StreamSession = {
      id: crypto.randomUUID(),
      filepath,
      sessionId,
      service,
      size: 0, // Will be calculated during writing
      processed: 0,
      startTime: performance.now(),
      lastActivity: Date.now(),
    };

    this.activeStreams.set(session.id, session);

    const chunkSize = options.chunkSize || this.config.streamChunkSize;
    let totalBytes = 0;

    // Create file write stream
    const fileStream = fs.createWriteStream(fullPath, {
      highWaterMark: chunkSize,
    });

    // Decompression stream if needed
    let decompressionStream: Transform | null = null;
    if (options.compressionLevel !== undefined) {
      decompressionStream = zlib.createGunzip();
    }

    // Checksum verification stream if checksum provided
    let verifyStream: Transform | null = null;
    if (options.enableChecksum) {
      const hash = crypto.createHash('sha256');
      verifyStream = new Transform({
        transform(chunk, encoding, callback) {
          hash.update(chunk);
          totalBytes += chunk.length;
          session.processed = totalBytes;
          session.lastActivity = Date.now();
          callback(null, chunk);
        },
        flush(callback) {
          if (session.checksum) {
            const calculatedChecksum = hash.digest('hex');
            if (calculatedChecksum !== session.checksum) {
              callback(new Error('Checksum verification failed'));
              return;
            }
          }
          callback();
        },
      });
    }

    // Transform stream for processing
    const transformStream = new Transform({
      transform(chunk, encoding, callback) {
        totalBytes += chunk.length;
        session.processed = totalBytes;
        session.lastActivity = Date.now();
        session.size = totalBytes;

        // Memory pressure check during processing
        if (totalBytes % (chunkSize * 10) === 0) {
          this.checkMemoryPressure();
        }

        callback(null, chunk);
      },
    });

    // Build pipeline
    const streams: Transform[] = [transformStream];

    if (decompressionStream) streams.unshift(decompressionStream);
    if (verifyStream) streams.push(verifyStream);

    // Connect streams
    let inputStream: Writable = transformStream;

    if (decompressionStream) {
      decompressionStream.pipe(transformStream);
      inputStream = decompressionStream;
    }

    if (verifyStream) {
      transformStream.pipe(verifyStream);
      verifyStream.pipe(fileStream);
    } else {
      transformStream.pipe(fileStream);
    }

    // Handle completion and errors
    fileStream.on('finish', () => {
      session.size = totalBytes;
      this.emit('streamCompleted', session);
    });

    fileStream.on('error', (error) => {
      this.emit('streamError', { session, error });
    });

    // Cleanup on destroy
    inputStream.on('close', () => {
      this.activeStreams.delete(session.id);
    });

    this.emit('streamStarted', session);
    return inputStream;
  }

  /**
   * Perform garbage collection optimization
   */
  async optimizeGarbageCollection(): Promise<GCResult> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      this.gcStats.collections++;
    }

    // Trigger cache eviction if memory pressure is high
    const pressureLevel = await this.getMemoryPressureLevel();
    let evictedEntries = 0;

    if (pressureLevel === MemoryPressureLevel.HIGH || pressureLevel === MemoryPressureLevel.CRITICAL) {
      evictedEntries = await this.evictCacheEntries();
    }

    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    const timeSpent = endTime - startTime;
    const memoryFreed = startMemory.heapUsed - endMemory.heapUsed;

    this.gcStats.totalTime += timeSpent;
    this.gcStats.lastGC = Date.now();

    const result: GCResult = {
      collectionsPerformed: 1,
      memoryFreed: Math.max(0, memoryFreed),
      timeSpent,
      efficiency: timeSpent > 0 ? memoryFreed / timeSpent : 0,
      recommendations: [],
    };

    // Generate recommendations
    if (result.memoryFreed < 10 * 1024 * 1024) { // Less than 10MB freed
      result.recommendations.push('Consider reducing cache size');
      result.recommendations.push('Review memory allocation patterns');
    }

    if (timeSpent > 100) { // More than 100ms spent on GC
      result.recommendations.push('GC is taking too long, consider memory optimization');
    }

    if (evictedEntries > 0) {
      result.recommendations.push(`Evicted ${evictedEntries} cache entries to reduce memory pressure`);
    }

    this.emit('gcOptimizationComplete', result);
    return result;
  }

  /**
   * Evict cache entries to reduce memory pressure
   */
  private async evictCacheEntries(): Promise<number> {
    // This would integrate with the cache managers
    // For now, return a simulated number
    const entriesToEvict = Math.min(this.config.cacheEvictionBatchSize, 50);
    this.emit('cacheEntriesEvicted', entriesToEvict);
    return entriesToEvict;
  }

  /**
   * Get current memory pressure level
   */
  async getMemoryPressureLevel(): Promise<MemoryPressureLevel> {
    const stats = await this.getMemoryStats();

    if (stats.pressureLevel === MemoryPressureLevel.CRITICAL) {
      return MemoryPressureLevel.CRITICAL;
    }

    const usageRatio = stats.heapUsed / this.config.maxHeapSize;

    if (usageRatio >= this.config.memoryPressureThresholds.critical) {
      return MemoryPressureLevel.CRITICAL;
    } else if (usageRatio >= this.config.memoryPressureThresholds.high) {
      return MemoryPressureLevel.HIGH;
    } else if (usageRatio >= this.config.memoryPressureThresholds.medium) {
      return MemoryPressureLevel.MEDIUM;
    }

    return MemoryPressureLevel.LOW;
  }

  /**
   * Get comprehensive memory statistics
   */
  async getMemoryStats(): Promise<MemoryStats> {
    const memUsage = process.memoryUsage();
    const v8Stats = v8.getHeapStatistics();

    const pressureLevel = await this.getMemoryPressureLevel();

    const stats: MemoryStats = {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      pressureLevel,
      cacheSize: this.estimateCacheSize(),
      activeStreams: this.activeStreams.size,
    };

    // Add GC stats if available
    if (this.gcStats.collections > 0) {
      stats.garbageCollectionStats = {
        collections: this.gcStats.collections,
        totalTime: this.gcStats.totalTime,
        averageTime: this.gcStats.totalTime / this.gcStats.collections,
      };
    }

    // Store in history for trend analysis
    this.memoryHistory.push({
      timestamp: Date.now(),
      stats: { ...stats },
    });

    // Keep only recent history (last 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    this.memoryHistory = this.memoryHistory.filter(h => h.timestamp > oneDayAgo);

    return stats;
  }

  /**
   * Detect memory leaks
   */
  async detectMemoryLeaks(): Promise<MemoryLeakAnalysis> {
    const windowHours = this.config.leakDetectionWindow;
    const windowMs = windowHours * 60 * 60 * 1000;
    const cutoffTime = Date.now() - windowMs;

    const recentHistory = this.memoryHistory.filter(h => h.timestamp > cutoffTime);

    if (recentHistory.length < 2) {
      return {
        detected: false,
        severity: 'low',
        description: 'Insufficient data for leak detection',
        recommendations: ['Collect more memory usage data over time'],
        growthRate: 0,
        timeWindow: windowHours,
      };
    }

    // Calculate memory growth rate
    const firstSample = recentHistory[0];
    const lastSample = recentHistory[recentHistory.length - 1];
    const timeDiffHours = (lastSample.timestamp - firstSample.timestamp) / (60 * 60 * 1000);
    const memoryGrowth = lastSample.stats.heapUsed - firstSample.stats.heapUsed;
    const growthRate = timeDiffHours > 0 ? memoryGrowth / timeDiffHours : 0; // MB per hour

    // Analyze growth pattern
    const growthThreshold = 50 * 1024 * 1024; // 50MB per hour threshold
    const detected = Math.abs(growthRate) > growthThreshold;

    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let description = '';
    const recommendations: string[] = [];

    if (detected) {
      if (Math.abs(growthRate) > 200 * 1024 * 1024) { // 200MB/hour
        severity = 'critical';
        description = `Critical memory leak detected: ${(growthRate / (1024 * 1024)).toFixed(2)} MB/hour growth rate`;
        recommendations.push('Immediate action required - memory leak detected');
        recommendations.push('Review recent code changes for memory allocation issues');
        recommendations.push('Consider restarting the service');
      } else if (Math.abs(growthRate) > 100 * 1024 * 1024) { // 100MB/hour
        severity = 'high';
        description = `High memory leak detected: ${(growthRate / (1024 * 1024)).toFixed(2)} MB/hour growth rate`;
        recommendations.push('Investigate memory allocation patterns');
        recommendations.push('Monitor for further memory growth');
      } else {
        severity = 'medium';
        description = `Memory leak detected: ${(growthRate / (1024 * 1024)).toFixed(2)} MB/hour growth rate`;
        recommendations.push('Monitor memory usage closely');
        recommendations.push('Review recent changes for potential memory issues');
      }
    } else {
      description = `No memory leak detected. Growth rate: ${(growthRate / (1024 * 1024)).toFixed(2)} MB/hour`;
      recommendations.push('Memory usage appears stable');
    }

    return {
      detected,
      severity,
      description,
      recommendations,
      growthRate: growthRate / (1024 * 1024), // Convert to MB
      timeWindow: windowHours,
    };
  }

  /**
   * Estimate total cache size across all cache managers
   */
  private estimateCacheSize(): number {
    // This would integrate with actual cache managers
    // For now, return a rough estimate
    return 100 * 1024 * 1024; // 100MB estimate
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    this.memoryCheckTimer = setInterval(async () => {
      try {
        const stats = await this.getMemoryStats();

        // Check for memory pressure changes
        if (stats.pressureLevel !== MemoryPressureLevel.LOW) {
          this.emit('memoryPressure', {
            level: stats.pressureLevel,
            stats,
            timestamp: Date.now(),
          });
        }

        // Store stats in Redis if available
        if (this.redis) {
          await this.redis.setEx(
            `memory_stats:${Date.now()}`,
            3600, // 1 hour
            JSON.stringify(stats)
          );
        }
      } catch (error) {
        this.emit('memoryMonitoringError', error);
      }
    }, this.config.memoryCheckInterval * 1000);
  }

  /**
   * Start garbage collection monitoring
   */
  private startGCMonitoring(): void {
    this.gcTimer = setInterval(async () => {
      try {
        const pressureLevel = await this.getMemoryPressureLevel();

        if (pressureLevel === MemoryPressureLevel.HIGH || pressureLevel === MemoryPressureLevel.CRITICAL) {
          await this.optimizeGarbageCollection();
        }
      } catch (error) {
        this.emit('gcMonitoringError', error);
      }
    }, this.config.gcInterval * 1000);
  }

  /**
   * Get active stream sessions
   */
  getActiveStreams(): StreamSession[] {
    return Array.from(this.activeStreams.values());
  }

  /**
   * Cancel a stream session
   */
  async cancelStream(streamId: string): Promise<void> {
    const session = this.activeStreams.get(streamId);
    if (session) {
      this.activeStreams.delete(streamId);
      this.emit('streamCancelled', session);
    }
  }

  /**
   * Get memory usage trends
   */
  getMemoryTrends(hours: number = 24): Array<{ timestamp: number; stats: MemoryStats }> {
    const cutoffTime = Date.now() - (hours * 60 * 60 * 1000);
    return this.memoryHistory.filter(h => h.timestamp > cutoffTime);
  }

  /**
   * Force cleanup of idle streams
   */
  async cleanupIdleStreams(maxIdleTime: number = 300000): Promise<number> { // 5 minutes default
    const now = Date.now();
    const idleStreams: string[] = [];

    for (const [streamId, session] of this.activeStreams) {
      if (now - session.lastActivity > maxIdleTime) {
        idleStreams.push(streamId);
      }
    }

    idleStreams.forEach(streamId => {
      this.activeStreams.delete(streamId);
    });

    if (idleStreams.length > 0) {
      this.emit('idleStreamsCleaned', idleStreams.length);
    }

    return idleStreams.length;
  }

  /**
   * Close the memory manager and cleanup resources
   */
  async close(): Promise<void> {
    if (this.memoryCheckTimer) {
      clearInterval(this.memoryCheckTimer);
      this.memoryCheckTimer = null;
    }

    if (this.gcTimer) {
      clearInterval(this.gcTimer);
      this.gcTimer = null;
    }

    // Cancel all active streams
    for (const streamId of this.activeStreams.keys()) {
      await this.cancelStream(streamId);
    }

    if (this.redis) {
      await this.redis.quit();
    }

    this.emit('closed');
  }
}

/**
 * Default memory manager configuration
 */
export const DEFAULT_MEMORY_CONFIG: MemoryManagerConfig = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  maxHeapSize: 1024 * 1024 * 1024, // 1GB
  memoryPressureThresholds: {
    medium: 0.7, // 70%
    high: 0.85, // 85%
    critical: 0.95, // 95%
  },
  streamChunkSize: 64 * 1024, // 64KB chunks
  maxConcurrentStreams: 10,
  gcInterval: 300, // 5 minutes
  memoryCheckInterval: 60, // 1 minute
  leakDetectionWindow: 6, // 6 hours
  cacheEvictionBatchSize: 100,
  enableCompression: true,
  compressionThreshold: 1024 * 1024, // 1MB
};

/**
 * Factory function to create MemoryManager
 */
export function createMemoryManager(config?: Partial<MemoryManagerConfig>): MemoryManager {
  return new MemoryManager({ ...DEFAULT_MEMORY_CONFIG, ...config });
}
