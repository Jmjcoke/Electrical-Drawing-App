import { jest } from '@jest/globals';
import { MemoryManager, createMemoryManager, MemoryPressureLevel } from '../memory-manager';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Readable, Writable } from 'stream';

// Mock Redis client
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    setEx: jest.fn(),
    get: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
  })),
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
  stat: jest.fn(),
  mkdir: jest.fn(),
  createReadStream: jest.fn(),
  createWriteStream: jest.fn(),
}));

// Mock v8
jest.mock('v8', () => ({
  getHeapStatistics: jest.fn(() => ({
    heap_size_limit: 1024 * 1024 * 1024, // 1GB
    used_heap_size: 512 * 1024 * 1024, // 512MB
    total_heap_size: 768 * 1024 * 1024, // 768MB
  })),
}));

describe('MemoryManager', () => {
  let memoryManager: MemoryManager;
  let mockRedis: any;

  beforeEach(() => {
    jest.useFakeTimers();
    memoryManager = createMemoryManager({
      redisUrl: 'redis://localhost:6379',
      maxHeapSize: 1024 * 1024 * 1024, // 1GB
      memoryCheckInterval: 60,
      gcInterval: 300,
    });

    mockRedis = (memoryManager as any).redis;
  });

  afterEach(async () => {
    await memoryManager.close();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      const defaultManager = createMemoryManager();
      expect(defaultManager).toBeDefined();
    });

    test('should initialize with custom configuration', () => {
      expect(memoryManager).toBeDefined();
    });
  });

  describe('Memory Pressure Monitoring', () => {
    test('should return LOW pressure when memory usage is normal', async () => {
      // Mock normal memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn(() => ({
        heapUsed: 256 * 1024 * 1024, // 256MB
        heapTotal: 512 * 1024 * 1024, // 512MB
        external: 0,
        rss: 0,
        arrayBuffers: 0,
      }));

      const pressureLevel = await memoryManager.getMemoryPressureLevel();
      expect(pressureLevel).toBe(MemoryPressureLevel.LOW);

      process.memoryUsage = originalMemoryUsage;
    });

    test('should return CRITICAL pressure when memory usage is high', async () => {
      // Mock critical memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn(() => ({
        heapUsed: 980 * 1024 * 1024, // 980MB
        heapTotal: 1024 * 1024 * 1024, // 1GB
        external: 0,
        rss: 0,
        arrayBuffers: 0,
      }));

      const pressureLevel = await memoryManager.getMemoryPressureLevel();
      expect(pressureLevel).toBe(MemoryPressureLevel.CRITICAL);

      process.memoryUsage = originalMemoryUsage;
    });

    test('should calculate memory pressure thresholds correctly', async () => {
      // Mock medium memory usage (70% of max heap)
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn(() => ({
        heapUsed: 716 * 1024 * 1024, // ~70% of 1GB
        heapTotal: 1024 * 1024 * 1024,
        external: 0,
        rss: 0,
        arrayBuffers: 0,
      }));

      const pressureLevel = await memoryManager.getMemoryPressureLevel();
      expect(pressureLevel).toBe(MemoryPressureLevel.MEDIUM);

      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('Memory Statistics', () => {
    test('should provide comprehensive memory statistics', async () => {
      const stats = await memoryManager.getMemoryStats();

      expect(stats).toBeDefined();
      expect(stats.heapUsed).toBeDefined();
      expect(stats.heapTotal).toBeDefined();
      expect(stats.pressureLevel).toBeDefined();
      expect(stats.cacheSize).toBeDefined();
      expect(stats.activeStreams).toBeDefined();
    });

    test('should track memory usage history', async () => {
      await memoryManager.getMemoryStats();
      await memoryManager.getMemoryStats();

      const trends = memoryManager.getMemoryTrends(1);
      expect(trends.length).toBeGreaterThanOrEqual(2);
    });

    test('should store stats in Redis when available', async () => {
      mockRedis.setEx.mockResolvedValue('OK');

      await memoryManager.getMemoryStats();

      expect(mockRedis.setEx).toHaveBeenCalledWith(
        expect.stringContaining('memory_stats:'),
        3600,
        expect.any(String)
      );
    });
  });

  describe('Stream Management', () => {
    beforeEach(() => {
      // Mock fs operations
      const mockFs = require('fs/promises');
      mockFs.stat.mockResolvedValue({ size: 1024 * 1024 }); // 1MB file
      mockFs.mkdir.mockResolvedValue(undefined);
    });

    test('should create read stream with memory monitoring', async () => {
      const mockFs = require('fs/promises');
      const mockReadStream = new Readable();
      mockReadStream.push('test data');
      mockReadStream.push(null);

      mockFs.createReadStream.mockReturnValue(mockReadStream);

      const stream = await memoryManager.createReadStream('session1', 'test.txt', 'test-service');

      expect(stream).toBeDefined();
      expect(memoryManager.getActiveStreams()).toHaveLength(1);
    });

    test('should create write stream with memory monitoring', async () => {
      const mockFs = require('fs/promises');
      const mockWriteStream = new Writable({
        write(chunk, encoding, callback) {
          callback();
        },
      });

      mockFs.createWriteStream.mockReturnValue(mockWriteStream);

      const stream = await memoryManager.createWriteStream('session1', 'test.txt', 'test-service');

      expect(stream).toBeDefined();
      expect(memoryManager.getActiveStreams()).toHaveLength(1);
    });

    test('should reject new streams when memory pressure is critical', async () => {
      // Mock critical memory pressure
      const originalGetPressureLevel = memoryManager.getMemoryPressureLevel;
      memoryManager.getMemoryPressureLevel = jest.fn().mockResolvedValue(MemoryPressureLevel.CRITICAL);

      await expect(
        memoryManager.createReadStream('session1', 'test.txt', 'test-service')
      ).rejects.toThrow('Memory pressure too high');

      memoryManager.getMemoryPressureLevel = originalGetPressureLevel;
    });

    test('should limit concurrent streams', async () => {
      const maxStreams = (memoryManager as any).config.maxConcurrentStreams;

      // Mock multiple active streams
      for (let i = 0; i < maxStreams; i++) {
        (memoryManager as any).activeStreams.set(`stream-${i}`, {
          id: `stream-${i}`,
          filepath: 'test.txt',
          sessionId: 'session1',
          service: 'test-service',
          size: 1000,
          processed: 0,
          startTime: Date.now(),
          lastActivity: Date.now(),
        });
      }

      await expect(
        memoryManager.createReadStream('session1', 'test2.txt', 'test-service')
      ).rejects.toThrow('Maximum concurrent streams limit reached');
    });

    test('should cancel streams correctly', async () => {
      // Add a mock active stream
      const streamId = 'test-stream';
      (memoryManager as any).activeStreams.set(streamId, {
        id: streamId,
        filepath: 'test.txt',
        sessionId: 'session1',
        service: 'test-service',
        size: 1000,
        processed: 0,
        startTime: Date.now(),
        lastActivity: Date.now(),
      });

      expect(memoryManager.getActiveStreams()).toHaveLength(1);

      await memoryManager.cancelStream(streamId);

      expect(memoryManager.getActiveStreams()).toHaveLength(0);
    });

    test('should cleanup idle streams', async () => {
      // Add a mock idle stream
      const streamId = 'idle-stream';
      const idleTime = Date.now() - 600000; // 10 minutes ago

      (memoryManager as any).activeStreams.set(streamId, {
        id: streamId,
        filepath: 'test.txt',
        sessionId: 'session1',
        service: 'test-service',
        size: 1000,
        processed: 0,
        startTime: idleTime,
        lastActivity: idleTime,
      });

      const cleanedCount = await memoryManager.cleanupIdleStreams(300000); // 5 minutes

      expect(cleanedCount).toBe(1);
      expect(memoryManager.getActiveStreams()).toHaveLength(0);
    });
  });

  describe('Garbage Collection Optimization', () => {
    test('should perform garbage collection optimization', async () => {
      // Mock global.gc
      const originalGc = global.gc;
      global.gc = jest.fn();

      const result = await memoryManager['optimizeGarbageCollection']();

      expect(result).toBeDefined();
      expect(result.collectionsPerformed).toBe(1);
      expect(result.memoryFreed).toBeDefined();
      expect(result.timeSpent).toBeGreaterThan(0);
      expect(result.recommendations).toBeDefined();

      global.gc = originalGc;
    });

    test('should trigger cache eviction under high memory pressure', async () => {
      // Mock high memory pressure
      const originalGetPressureLevel = memoryManager.getMemoryPressureLevel;
      memoryManager.getMemoryPressureLevel = jest.fn().mockResolvedValue(MemoryPressureLevel.HIGH);

      // Mock global.gc
      const originalGc = global.gc;
      global.gc = jest.fn();

      const result = await memoryManager['optimizeGarbageCollection']();

      expect(result.recommendations.some(r => r.includes('Evicted'))).toBe(true);

      memoryManager.getMemoryPressureLevel = originalGetPressureLevel;
      global.gc = originalGc;
    });
  });

  describe('Memory Leak Detection', () => {
    test('should detect memory leaks with significant growth', async () => {
      // Add mock memory history with significant growth
      const mockHistory = [];
      const baseTime = Date.now() - 6 * 60 * 60 * 1000; // 6 hours ago

      for (let i = 0; i < 6; i++) {
        mockHistory.push({
          timestamp: baseTime + i * 60 * 60 * 1000, // Every hour
          stats: {
            heapUsed: 100 * 1024 * 1024 + i * 100 * 1024 * 1024, // 100MB + 100MB per hour
            heapTotal: 512 * 1024 * 1024,
            external: 0,
            rss: 0,
            pressureLevel: MemoryPressureLevel.LOW,
            cacheSize: 50 * 1024 * 1024,
            activeStreams: 0,
          },
        });
      }

      (memoryManager as any).memoryHistory = mockHistory;

      const leakAnalysis = await memoryManager.detectMemoryLeaks();

      expect(leakAnalysis.detected).toBe(true);
      expect(leakAnalysis.severity).toBe('high');
      expect(leakAnalysis.growthRate).toBeGreaterThan(50); // More than 50MB/hour
      expect(leakAnalysis.recommendations).toContain('Investigate memory allocation patterns');
    });

    test('should not detect leaks with stable memory usage', async () => {
      // Add mock memory history with stable usage
      const mockHistory = [];
      const baseTime = Date.now() - 6 * 60 * 60 * 1000; // 6 hours ago

      for (let i = 0; i < 6; i++) {
        mockHistory.push({
          timestamp: baseTime + i * 60 * 60 * 1000,
          stats: {
            heapUsed: 200 * 1024 * 1024, // Stable 200MB
            heapTotal: 512 * 1024 * 1024,
            external: 0,
            rss: 0,
            pressureLevel: MemoryPressureLevel.LOW,
            cacheSize: 50 * 1024 * 1024,
            activeStreams: 0,
          },
        });
      }

      (memoryManager as any).memoryHistory = mockHistory;

      const leakAnalysis = await memoryManager.detectMemoryLeaks();

      expect(leakAnalysis.detected).toBe(false);
      expect(leakAnalysis.severity).toBe('low');
      expect(Math.abs(leakAnalysis.growthRate)).toBeLessThan(10); // Less than 10MB/hour
    });

    test('should handle insufficient data for leak detection', async () => {
      // Clear memory history
      (memoryManager as any).memoryHistory = [];

      const leakAnalysis = await memoryManager.detectMemoryLeaks();

      expect(leakAnalysis.detected).toBe(false);
      expect(leakAnalysis.description).toContain('Insufficient data');
      expect(leakAnalysis.recommendations).toContain('Collect more memory usage data');
    });
  });

  describe('Memory Trends Analysis', () => {
    test('should provide memory usage trends', async () => {
      // Add some mock history data
      const mockHistory = [];
      const baseTime = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago

      for (let i = 0; i < 10; i++) {
        mockHistory.push({
          timestamp: baseTime + i * 10 * 60 * 1000, // Every 10 minutes
          stats: {
            heapUsed: 200 * 1024 * 1024 + i * 10 * 1024 * 1024,
            heapTotal: 512 * 1024 * 1024,
            external: 0,
            rss: 0,
            pressureLevel: MemoryPressureLevel.LOW,
            cacheSize: 50 * 1024 * 1024,
            activeStreams: 0,
          },
        });
      }

      (memoryManager as any).memoryHistory = mockHistory;

      const trends = memoryManager.getMemoryTrends(1); // Last hour

      expect(trends.length).toBeGreaterThan(0);
      expect(trends.every(t => t.timestamp > Date.now() - 60 * 60 * 1000)).toBe(true);
    });
  });

  describe('Event Emission', () => {
    test('should emit memory pressure events', async () => {
      const mockEmit = jest.fn();
      const originalEmit = memoryManager.emit;
      memoryManager.emit = mockEmit;

      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn(() => ({
        heapUsed: 900 * 1024 * 1024, // 900MB
        heapTotal: 1024 * 1024 * 1024,
        external: 0,
        rss: 0,
        arrayBuffers: 0,
      }));

      // Trigger memory check
      await memoryManager.getMemoryStats();

      expect(mockEmit).toHaveBeenCalledWith('memoryPressure', expect.objectContaining({
        level: MemoryPressureLevel.HIGH,
        stats: expect.any(Object),
      }));

      process.memoryUsage = originalMemoryUsage;
      memoryManager.emit = originalEmit;
    });

    test('should emit stream lifecycle events', async () => {
      const mockEmit = jest.fn();
      const originalEmit = memoryManager.emit;
      memoryManager.emit = mockEmit;

      // Mock fs operations for read stream
      const mockFs = require('fs/promises');
      const mockReadStream = new Readable();
      mockReadStream.push('test data');
      mockReadStream.push(null);

      mockFs.stat.mockResolvedValue({ size: 1024 });
      mockFs.createReadStream.mockReturnValue(mockReadStream);

      await memoryManager.createReadStream('session1', 'test.txt', 'test-service');

      expect(mockEmit).toHaveBeenCalledWith('streamStarted', expect.any(Object));

      memoryManager.emit = originalEmit;
    });

    test('should emit GC optimization events', async () => {
      const mockEmit = jest.fn();
      const originalEmit = memoryManager.emit;
      memoryManager.emit = mockEmit;

      // Mock global.gc
      const originalGc = global.gc;
      global.gc = jest.fn();

      await memoryManager['optimizeGarbageCollection']();

      expect(mockEmit).toHaveBeenCalledWith('gcOptimizationComplete', expect.any(Object));

      global.gc = originalGc;
      memoryManager.emit = originalEmit;
    });
  });

  describe('Resource Management', () => {
    test('should cleanup resources on close', async () => {
      // Add a mock active stream
      (memoryManager as any).activeStreams.set('test-stream', {
        id: 'test-stream',
        filepath: 'test.txt',
        sessionId: 'session1',
        service: 'test-service',
        size: 1000,
        processed: 0,
        startTime: Date.now(),
        lastActivity: Date.now(),
      });

      expect(memoryManager.getActiveStreams()).toHaveLength(1);

      await memoryManager.close();

      expect(memoryManager.getActiveStreams()).toHaveLength(0);
      expect(mockRedis.quit).toHaveBeenCalled();
    });

    test('should handle Redis connection errors gracefully', async () => {
      mockRedis.connect.mockRejectedValue(new Error('Redis connection failed'));

      // Should not throw error during initialization
      const managerWithRedisError = createMemoryManager({
        redisUrl: 'redis://invalid:6379',
      });

      expect(managerWithRedisError).toBeDefined();
      await managerWithRedisError.close();
    });
  });

  describe('Configuration', () => {
    test('should respect custom configuration values', () => {
      const customManager = createMemoryManager({
        maxHeapSize: 512 * 1024 * 1024, // 512MB
        maxConcurrentStreams: 5,
        streamChunkSize: 32 * 1024, // 32KB
      });

      expect((customManager as any).config.maxHeapSize).toBe(512 * 1024 * 1024);
      expect((customManager as any).config.maxConcurrentStreams).toBe(5);
      expect((customManager as any).config.streamChunkSize).toBe(32 * 1024);

      customManager.close();
    });

    test('should use default values for unspecified configuration', () => {
      const partialConfigManager = createMemoryManager({
        maxHeapSize: 2 * 1024 * 1024 * 1024, // Only specify one value
      });

      expect((partialConfigManager as any).config.maxHeapSize).toBe(2 * 1024 * 1024 * 1024);
      expect((partialConfigManager as any).config.maxConcurrentStreams).toBe(10); // Default value
      expect((partialConfigManager as any).config.enableCompression).toBe(true); // Default value

      partialConfigManager.close();
    });
  });

  describe('Integration Scenarios', () => {
    test('should handle multiple concurrent streams', async () => {
      const maxStreams = (memoryManager as any).config.maxConcurrentStreams - 1; // Leave room for one more

      // Add multiple active streams
      for (let i = 0; i < maxStreams; i++) {
        (memoryManager as any).activeStreams.set(`stream-${i}`, {
          id: `stream-${i}`,
          filepath: `test${i}.txt`,
          sessionId: 'session1',
          service: 'test-service',
          size: 1000,
          processed: 0,
          startTime: Date.now(),
          lastActivity: Date.now(),
        });
      }

      expect(memoryManager.getActiveStreams()).toHaveLength(maxStreams);

      // Should be able to add one more stream
      const mockFs = require('fs/promises');
      const mockReadStream = new Readable();
      mockReadStream.push('test');
      mockReadStream.push(null);

      mockFs.stat.mockResolvedValue({ size: 100 });
      mockFs.createReadStream.mockReturnValue(mockReadStream);

      const stream = await memoryManager.createReadStream('session1', 'last.txt', 'test-service');
      expect(stream).toBeDefined();
      expect(memoryManager.getActiveStreams()).toHaveLength(maxStreams + 1);
    });

    test('should provide comprehensive system state', async () => {
      // Add some test data
      (memoryManager as any).activeStreams.set('test-stream', {
        id: 'test-stream',
        filepath: 'test.txt',
        sessionId: 'session1',
        service: 'test-service',
        size: 1000,
        processed: 500,
        startTime: Date.now() - 60000, // 1 minute ago
        lastActivity: Date.now(),
      });

      // Add some memory history
      (memoryManager as any).memoryHistory.push({
        timestamp: Date.now(),
        stats: await memoryManager.getMemoryStats(),
      });

      const stats = await memoryManager.getMemoryStats();

      expect(stats.activeStreams).toBe(1);
      expect(stats.heapUsed).toBeDefined();
      expect(stats.pressureLevel).toBeDefined();

      const trends = memoryManager.getMemoryTrends();
      expect(trends.length).toBeGreaterThan(0);

      const activeStreams = memoryManager.getActiveStreams();
      expect(activeStreams).toHaveLength(1);
      expect(activeStreams[0].id).toBe('test-stream');
    });
  });
});
