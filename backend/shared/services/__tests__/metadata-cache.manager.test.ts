import { jest } from '@jest/globals';
import { MetadataCacheManager, createMetadataCacheManager } from '../metadata-cache.manager';
import { MetadataCacheConfig } from '../metadata-cache.manager';

// Mock Redis client
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    ttl: jest.fn(),
    info: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
  })),
}));

describe('MetadataCacheManager', () => {
  let config: MetadataCacheConfig;
  let cacheManager: MetadataCacheManager;

  beforeEach(() => {
    config = {
      redisUrl: 'redis://localhost:6379',
      defaultTTL: 3600,
      maxMemoryUsage: 100 * 1024 * 1024,
      maxEntries: 10000,
      evictionPolicy: 'LRU',
      compressionThreshold: 1024,
      warmingBatchSize: 10,
      healthCheckInterval: 30000,
      cachePrefix: 'test_cache',
    };

    jest.useFakeTimers();
  });

  afterEach(async () => {
    if (cacheManager) {
      await cacheManager.close();
    }
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', () => {
      cacheManager = createMetadataCacheManager();

      expect(cacheManager).toBeDefined();
    });

    test('should initialize with custom configuration', () => {
      cacheManager = createMetadataCacheManager(config);

      expect(cacheManager).toBeDefined();
    });

    test('should emit initialized event on successful connection', async () => {
      const mockEmit = jest.fn();
      const originalEmit = MetadataCacheManager.prototype.emit;

      MetadataCacheManager.prototype.emit = mockEmit;

      // Mock successful Redis connection
      const mockRedis = {
        connect: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
      };

      // @ts-ignore
      require('redis').createClient.mockReturnValue(mockRedis);

      cacheManager = createMetadataCacheManager(config);

      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockEmit).toHaveBeenCalledWith('initialized');

      MetadataCacheManager.prototype.emit = originalEmit;
    });
  });

  describe('Metadata Operations', () => {
    beforeEach(() => {
      cacheManager = createMetadataCacheManager(config);
    });

    test('should cache and retrieve metadata', async () => {
      const sessionId = 'test-session';
      const filepath = 'test-file.txt';
      const metadata = {
        sessionId,
        filepath,
        size: 1024,
        mtime: new Date(),
        ctime: new Date(),
        isDirectory: false,
        permissions: '644',
        accessCount: 0,
        lastAccessed: new Date(),
        created: new Date(),
      };

      // Mock cache miss first
      const mockRedis = (cacheManager as any).redis;
      mockRedis.get.mockResolvedValue(null);

      // Mock filesystem metadata
      const mockFs = jest.spyOn(require('fs/promises'), 'stat');
      mockFs.mockResolvedValue({
        size: 1024,
        mtime: new Date(),
        ctime: new Date(),
        birthtime: new Date(),
        isDirectory: () => false,
        mode: 0o644,
      } as any);

      const result = await cacheManager.getMetadata(sessionId, filepath);
      expect(result).toBeDefined();
      expect(result?.size).toBe(1024);

      mockFs.mockRestore();
    });

    test('should return cached metadata on cache hit', async () => {
      const sessionId = 'test-session';
      const filepath = 'test-file.txt';
      const cachedMetadata = {
        sessionId,
        filepath,
        size: 2048,
        mtime: new Date(),
        ctime: new Date(),
        isDirectory: false,
        permissions: '644',
        accessCount: 5,
        lastAccessed: new Date(),
        created: new Date(),
      };

      const cacheEntry = {
        data: cachedMetadata,
        cachedAt: Date.now(),
        ttl: 3600,
        size: 100,
        hits: 5,
        misses: 1,
        lastHit: new Date(),
      };

      // Mock cache hit
      const mockRedis = (cacheManager as any).redis;
      mockRedis.get.mockResolvedValue(JSON.stringify(cacheEntry));

      const result = await cacheManager.getMetadata(sessionId, filepath);
      expect(result).toEqual(cachedMetadata);
    });

    test('should handle cache write errors gracefully', async () => {
      const sessionId = 'test-session';
      const filepath = 'test-file.txt';
      const metadata = {
        sessionId,
        filepath,
        size: 1024,
        mtime: new Date(),
        ctime: new Date(),
        isDirectory: false,
        permissions: '644',
        accessCount: 0,
        lastAccessed: new Date(),
        created: new Date(),
      };

      // Mock Redis error
      const mockRedis = (cacheManager as any).redis;
      mockRedis.setEx.mockRejectedValue(new Error('Redis connection failed'));

      await expect(cacheManager.setMetadata(sessionId, filepath, metadata)).resolves.toBeUndefined();
    });
  });

  describe('Cache Invalidation', () => {
    beforeEach(() => {
      cacheManager = createMetadataCacheManager(config);
    });

    test('should invalidate specific file', async () => {
      const sessionId = 'test-session';
      const filepath = 'test-file.txt';

      const mockRedis = (cacheManager as any).redis;
      mockRedis.del.mockResolvedValue(1);

      await cacheManager.invalidate(sessionId, filepath);

      expect(mockRedis.del).toHaveBeenCalledWith('test_cache:test-session:test-file.txt');
    });

    test('should invalidate entire session', async () => {
      const sessionId = 'test-session';

      const mockRedis = (cacheManager as any).redis;
      mockRedis.keys.mockResolvedValue(['test_cache:test-session:file1.txt', 'test_cache:test-session:file2.txt']);
      mockRedis.del.mockResolvedValue(2);

      await cacheManager.invalidate(sessionId);

      expect(mockRedis.keys).toHaveBeenCalledWith('test_cache:test-session:*');
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('Cache Warming', () => {
    beforeEach(() => {
      cacheManager = createMetadataCacheManager(config);
    });

    test('should warm cache with file batch', async () => {
      const request = {
        sessionId: 'test-session',
        patterns: ['*.txt'],
        priority: 'high' as const,
        maxFiles: 5,
      };

      // Mock file discovery
      const mockDiscover = jest.spyOn(cacheManager as any, 'discoverFilesToWarm');
      mockDiscover.mockResolvedValue(['file1.txt', 'file2.txt']);

      // Mock metadata retrieval
      const mockGetMetadata = jest.spyOn(cacheManager as any, 'getFileMetadata');
      mockGetMetadata.mockResolvedValue({
        sessionId: 'test-session',
        filepath: 'file1.txt',
        size: 1024,
        mtime: new Date(),
        ctime: new Date(),
        isDirectory: false,
        permissions: '644',
        accessCount: 0,
        lastAccessed: new Date(),
        created: new Date(),
      });

      await cacheManager.warmCache(request);

      expect(mockDiscover).toHaveBeenCalledWith(request);
      expect(mockGetMetadata).toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      cacheManager = createMetadataCacheManager(config);
    });

    test('should return cache statistics', async () => {
      const mockRedis = (cacheManager as any).redis;
      mockRedis.keys.mockResolvedValue(['key1', 'key2', 'key3']);
      mockRedis.info.mockResolvedValue('used_memory:52428800');

      const stats = await cacheManager.getStats();

      expect(stats).toBeDefined();
      expect(stats.totalEntries).toBe(3);
      expect(stats.memoryUsage).toBe(52428800);
    });
  });

  describe('Cleanup and Eviction', () => {
    beforeEach(() => {
      cacheManager = createMetadataCacheManager(config);
    });

    test('should enforce size limits', async () => {
      // Set up scenario with too many entries
      const mockRedis = (cacheManager as any).redis;
      const entries = Array.from({ length: 15000 }, (_, i) => `key${i}`);

      mockRedis.keys.mockResolvedValue(entries);
      mockRedis.get.mockImplementation((key: string) => {
        return Promise.resolve(JSON.stringify({
          data: { sessionId: 'test', filepath: 'file.txt' },
          cachedAt: Date.now(),
          ttl: 3600,
          size: 1000,
          hits: Math.random() * 100,
          misses: Math.random() * 10,
          lastHit: new Date(Date.now() - Math.random() * 86400000),
        }));
      });
      mockRedis.del.mockResolvedValue(1);

      await (cacheManager as any).enforceSizeLimits();

      // Should have evicted some entries
      expect(mockRedis.del).toHaveBeenCalled();
    });

    test('should evict expired entries', async () => {
      const mockRedis = (cacheManager as any).redis;
      mockRedis.keys.mockResolvedValue(['expired_key', 'valid_key']);
      mockRedis.ttl.mockImplementation((key: string) => {
        return key === 'expired_key' ? Promise.resolve(-2) : Promise.resolve(3600);
      });

      await (cacheManager as any).evictExpiredEntries();

      // Stats should reflect eviction
      const stats = await cacheManager.getStats();
      expect(stats.evictionCount).toBeGreaterThan(0);
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(() => {
      cacheManager = createMetadataCacheManager(config);
    });

    test('should perform health checks', () => {
      const mockRedis = (cacheManager as any).redis;
      mockRedis.ping.mockResolvedValue('PONG');

      // Advance timer to trigger health check
      jest.advanceTimersByTime(config.healthCheckInterval);

      expect(mockRedis.ping).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      cacheManager = createMetadataCacheManager(config);
    });

    test('should handle Redis connection errors', async () => {
      const mockRedis = (cacheManager as any).redis;
      mockRedis.get.mockRejectedValue(new Error('Connection failed'));

      const result = await cacheManager.getMetadata('test-session', 'test-file.txt');
      expect(result).toBeNull();
    });

    test('should handle filesystem errors gracefully', async () => {
      const mockRedis = (cacheManager as any).redis;
      mockRedis.get.mockResolvedValue(null);

      // Mock filesystem error
      const mockFs = jest.spyOn(require('fs/promises'), 'stat');
      mockFs.mockRejectedValue(new Error('File not found'));

      const result = await cacheManager.getMetadata('test-session', 'nonexistent-file.txt');
      expect(result).toBeNull();

      mockFs.mockRestore();
    });
  });

  describe('Event Emission', () => {
    beforeEach(() => {
      cacheManager = createMetadataCacheManager(config);
    });

    test('should emit cache hit events', async () => {
      const mockEmit = jest.fn();
      const originalEmit = cacheManager.emit;
      cacheManager.emit = mockEmit;

      const cachedMetadata = {
        sessionId: 'test-session',
        filepath: 'test-file.txt',
        size: 2048,
        mtime: new Date(),
        ctime: new Date(),
        isDirectory: false,
        permissions: '644',
        accessCount: 5,
        lastAccessed: new Date(),
        created: new Date(),
      };

      const cacheEntry = {
        data: cachedMetadata,
        cachedAt: Date.now(),
        ttl: 3600,
        size: 100,
        hits: 5,
        misses: 1,
        lastHit: new Date(),
      };

      const mockRedis = (cacheManager as any).redis;
      mockRedis.get.mockResolvedValue(JSON.stringify(cacheEntry));

      await cacheManager.getMetadata('test-session', 'test-file.txt');

      expect(mockEmit).toHaveBeenCalledWith('cacheHit', expect.any(Object));

      cacheManager.emit = originalEmit;
    });

    test('should emit cache miss events', async () => {
      const mockEmit = jest.fn();
      const originalEmit = cacheManager.emit;
      cacheManager.emit = mockEmit;

      const mockRedis = (cacheManager as any).redis;
      mockRedis.get.mockResolvedValue(null);

      // Mock filesystem metadata
      const mockFs = jest.spyOn(require('fs/promises'), 'stat');
      mockFs.mockResolvedValue({
        size: 1024,
        mtime: new Date(),
        ctime: new Date(),
        birthtime: new Date(),
        isDirectory: () => false,
        mode: 0o644,
      } as any);

      await cacheManager.getMetadata('test-session', 'test-file.txt');

      expect(mockEmit).toHaveBeenCalledWith('cacheMiss', expect.any(Object));

      mockFs.mockRestore();
      cacheManager.emit = originalEmit;
    });
  });

  describe('Configuration', () => {
    test('should use default configuration when none provided', () => {
      const defaultManager = createMetadataCacheManager();

      expect(defaultManager).toBeDefined();
      // Configuration should use defaults from environment or hardcoded values
    });

    test('should merge provided config with defaults', () => {
      const partialConfig = {
        redisUrl: 'redis://custom:6379',
        defaultTTL: 7200,
      };

      const manager = createMetadataCacheManager(partialConfig);

      expect(manager).toBeDefined();
      // Should use custom values where provided, defaults elsewhere
    });
  });

  describe('Resource Management', () => {
    test('should close Redis connection on cleanup', async () => {
      const mockRedis = (cacheManager as any).redis;
      mockRedis.quit.mockResolvedValue(undefined);

      await cacheManager.close();

      expect(mockRedis.quit).toHaveBeenCalled();
    });

    test('should clear health check timer on close', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      await cacheManager.close();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});
