import { jest } from '@jest/globals';
import { IntelligentCacheManager, createIntelligentCacheManager } from '../intelligent-cache.manager';
import { IntelligentCacheConfig } from '../intelligent-cache.manager';

// Mock Redis client
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(),
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
    keys: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
  })),
}));

// Mock zlib
jest.mock('zlib', () => ({
  gzip: jest.fn((data, callback) => callback(null, Buffer.from('compressed'))),
  gunzip: jest.fn((data, callback) => callback(null, Buffer.from('decompressed'))),
}));

// Mock fs/promises
jest.mock('fs/promises', () => ({
  stat: jest.fn(),
  readFile: jest.fn(),
  readdir: jest.fn(),
}));

describe('IntelligentCacheManager', () => {
  let config: IntelligentCacheConfig;
  let cacheManager: IntelligentCacheManager;

  beforeEach(() => {
    config = {
      redisUrl: 'redis://localhost:6379',
      maxFileSize: 1024 * 1024, // 1MB
      minFileSize: 1024, // 1KB
      compressionThreshold: 4096, // 4KB
      maxMemoryUsage: 500 * 1024 * 1024, // 500MB
      defaultTTL: 3600, // 1 hour
      accessPatternWindow: 24,
      popularityThreshold: 0.3,
      cachePrefix: 'test_intelligent_cache',
      healthCheckInterval: 30000,
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
      cacheManager = createIntelligentCacheManager();
      expect(cacheManager).toBeDefined();
    });

    test('should initialize with custom configuration', () => {
      cacheManager = createIntelligentCacheManager(config);
      expect(cacheManager).toBeDefined();
    });
  });

  describe('Cache Decision Making', () => {
    beforeEach(() => {
      cacheManager = createIntelligentCacheManager(config);
    });

    test('should reject files that are too large', async () => {
      const decision = await cacheManager['shouldCacheFile']('test-session', 'large-file.dat', 2 * 1024 * 1024); // 2MB

      expect(decision.shouldCache).toBe(false);
      expect(decision.priority).toBe('none');
      expect(decision.reason).toContain('exceeds maximum cache size');
    });

    test('should reject files that are too small', async () => {
      const decision = await cacheManager['shouldCacheFile']('test-session', 'small-file.txt', 512); // 512B

      expect(decision.shouldCache).toBe(false);
      expect(decision.priority).toBe('none');
      expect(decision.reason).toContain('below minimum cache size');
    });

    test('should accept files within size limits with good access patterns', async () => {
      // Mock access pattern with high popularity
      const mockAnalyzePattern = jest.spyOn(cacheManager as any, 'analyzeAccessPattern');
      mockAnalyzePattern.mockResolvedValue({
        filepath: 'test-file.txt',
        accessCount: 100,
        accessFrequency: 10,
        lastAccess: new Date(),
        averageAccessInterval: 360000,
        volatilityScore: 0.1,
        popularityScore: 0.9,
      });

      const decision = await cacheManager['shouldCacheFile']('test-session', 'test-file.txt', 10000); // 10KB

      expect(decision.shouldCache).toBe(true);
      expect(decision.priority).toBe('high');
    });

    test('should calculate compression savings', async () => {
      const savings = await (cacheManager as any).estimateCompressionSavings(10000); // 10KB
      expect(savings).toBeGreaterThan(0);
      expect(savings).toBeLessThan(10000);
    });
  });

  describe('File Caching', () => {
    beforeEach(() => {
      cacheManager = createIntelligentCacheManager(config);
    });

    test('should cache file with compression', async () => {
      const sessionId = 'test-session';
      const filepath = 'test-file.txt';
      const content = Buffer.from('This is test content for compression testing');

      // Mock decision to cache
      const mockDecision = jest.spyOn(cacheManager as any, 'shouldCacheFile');
      mockDecision.mockResolvedValue({
        shouldCache: true,
        priority: 'high',
        reason: 'Test file',
        estimatedSize: 50,
        compressionSavings: 20,
      });

      // Mock Redis set
      const mockRedis = (cacheManager as any).redis;
      mockRedis.setEx.mockResolvedValue('OK');

      await cacheManager.cacheFile(sessionId, filepath, content);

      expect(mockRedis.setEx).toHaveBeenCalled();
      expect(mockDecision).toHaveBeenCalledWith(sessionId, filepath, content.length);
    });

    test('should not cache file when decision is negative', async () => {
      const sessionId = 'test-session';
      const filepath = 'test-file.txt';
      const content = Buffer.from('Small content');

      // Mock decision not to cache
      const mockDecision = jest.spyOn(cacheManager as any, 'shouldCacheFile');
      mockDecision.mockResolvedValue({
        shouldCache: false,
        priority: 'none',
        reason: 'File too small',
        estimatedSize: 0,
        compressionSavings: 0,
      });

      const mockRedis = (cacheManager as any).redis;
      mockRedis.setEx.mockResolvedValue('OK');

      await cacheManager.cacheFile(sessionId, filepath, content);

      // Should not call Redis set
      expect(mockRedis.setEx).not.toHaveBeenCalled();
    });
  });

  describe('File Retrieval', () => {
    beforeEach(() => {
      cacheManager = createIntelligentCacheManager(config);
    });

    test('should retrieve cached file successfully', async () => {
      const sessionId = 'test-session';
      const filepath = 'test-file.txt';

      const cachedEntry = {
        sessionId,
        filepath,
        content: Buffer.from('compressed_content'),
        originalSize: 100,
        compressedSize: 50,
        compressionRatio: 0.5,
        checksum: 'test_checksum',
        cachedAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 5,
        ttl: 3600,
      };

      // Mock Redis get
      const mockRedis = (cacheManager as any).redis;
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedEntry));
      mockRedis.setEx.mockResolvedValue('OK');

      const result = await cacheManager.getCachedFile(sessionId, filepath);

      expect(result).toBeDefined();
      expect(mockRedis.get).toHaveBeenCalledWith('test_intelligent_cache:test-session:test-file.txt');
      expect(mockRedis.setEx).toHaveBeenCalled(); // Update access stats
    });

    test('should return null when file not in cache', async () => {
      const sessionId = 'test-session';
      const filepath = 'missing-file.txt';

      // Mock Redis get returning null
      const mockRedis = (cacheManager as any).redis;
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheManager.getCachedFile(sessionId, filepath);

      expect(result).toBeNull();
    });
  });

  describe('Cache Preloading', () => {
    beforeEach(() => {
      cacheManager = createIntelligentCacheManager(config);
    });

    test('should preload cache based on patterns', async () => {
      const sessionId = 'test-session';
      const patterns = ['*.txt', '*.json'];

      // Mock pattern prediction
      const mockPredict = jest.spyOn(cacheManager as any, 'predictAccessPatterns');
      mockPredict.mockResolvedValue(['file1.txt', 'file2.json']);

      // Mock file operations
      const mockFs = require('fs/promises');
      mockFs.stat.mockImplementation((path: string) => {
        if (path.includes('file1.txt')) {
          return Promise.resolve({ size: 5000 });
        } else if (path.includes('file2.json')) {
          return Promise.resolve({ size: 2000 });
        }
        return Promise.reject(new Error('File not found'));
      });

      mockFs.readFile.mockImplementation((path: string) => {
        return Promise.resolve(Buffer.from('test content'));
      });

      // Mock cache decision
      const mockDecision = jest.spyOn(cacheManager as any, 'shouldCacheFile');
      mockDecision.mockResolvedValue({
        shouldCache: true,
        priority: 'medium',
        reason: 'Preload candidate',
        estimatedSize: 100,
        compressionSavings: 50,
      });

      await cacheManager.preloadCache(sessionId, patterns);

      expect(mockPredict).toHaveBeenCalledWith(sessionId, patterns);
      expect(mockFs.stat).toHaveBeenCalled();
      expect(mockFs.readFile).toHaveBeenCalled();
    });
  });

  describe('Cache Consistency Validation', () => {
    beforeEach(() => {
      cacheManager = createIntelligentCacheManager(config);
    });

    test('should validate consistent cache entry', async () => {
      const sessionId = 'test-session';
      const filepath = 'test-file.txt';

      const cachedEntry = {
        sessionId,
        filepath,
        content: Buffer.from('compressed'),
        originalSize: 100,
        compressedSize: 50,
        compressionRatio: 0.5,
        checksum: 'test_checksum',
        cachedAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 1,
        ttl: 3600,
      };

      // Mock Redis get
      const mockRedis = (cacheManager as any).redis;
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedEntry));

      // Mock filesystem
      const mockFs = require('fs/promises');
      mockFs.stat.mockResolvedValue({ size: 100 }); // Same size
      mockFs.readFile.mockResolvedValue(Buffer.from('original content'));

      // Mock checksum calculation
      const mockChecksum = jest.spyOn(cacheManager as any, 'calculateChecksum');
      mockChecksum.mockResolvedValue('test_checksum'); // Same checksum

      const isValid = await cacheManager.validateCacheConsistency(sessionId, filepath);

      expect(isValid).toBe(true);
      expect(mockRedis.del).not.toHaveBeenCalled(); // Should not invalidate
    });

    test('should invalidate cache when file size changed', async () => {
      const sessionId = 'test-session';
      const filepath = 'test-file.txt';

      const cachedEntry = {
        sessionId,
        filepath,
        content: Buffer.from('compressed'),
        originalSize: 100,
        compressedSize: 50,
        compressionRatio: 0.5,
        checksum: 'old_checksum',
        cachedAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 1,
        ttl: 3600,
      };

      // Mock Redis get and del
      const mockRedis = (cacheManager as any).redis;
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedEntry));
      mockRedis.del.mockResolvedValue(1);

      // Mock filesystem with different size
      const mockFs = require('fs/promises');
      mockFs.stat.mockResolvedValue({ size: 200 }); // Different size

      const isValid = await cacheManager.validateCacheConsistency(sessionId, filepath);

      expect(isValid).toBe(false);
      expect(mockRedis.del).toHaveBeenCalledWith('test_intelligent_cache:test-session:test-file.txt');
    });

    test('should invalidate cache when file content changed', async () => {
      const sessionId = 'test-session';
      const filepath = 'test-file.txt';

      const cachedEntry = {
        sessionId,
        filepath,
        content: Buffer.from('compressed'),
        originalSize: 100,
        compressedSize: 50,
        compressionRatio: 0.5,
        checksum: 'old_checksum',
        cachedAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 1,
        ttl: 3600,
      };

      // Mock Redis get and del
      const mockRedis = (cacheManager as any).redis;
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedEntry));
      mockRedis.del.mockResolvedValue(1);

      // Mock filesystem
      const mockFs = require('fs/promises');
      mockFs.stat.mockResolvedValue({ size: 100 }); // Same size
      mockFs.readFile.mockResolvedValue(Buffer.from('modified content'));

      // Mock checksum calculation with different result
      const mockChecksum = jest.spyOn(cacheManager as any, 'calculateChecksum');
      mockChecksum.mockResolvedValue('new_checksum'); // Different checksum

      const isValid = await cacheManager.validateCacheConsistency(sessionId, filepath);

      expect(isValid).toBe(false);
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('Cache Statistics', () => {
    beforeEach(() => {
      cacheManager = createIntelligentCacheManager(config);
    });

    test('should return cache statistics', async () => {
      const mockEntries = [
        {
          sessionId: 'session1',
          filepath: 'file1.txt',
          content: Buffer.from('compressed1'),
          originalSize: 1000,
          compressedSize: 500,
          compressionRatio: 0.5,
          checksum: 'checksum1',
          cachedAt: Date.now(),
          lastAccessed: Date.now(),
          accessCount: 10,
          ttl: 3600,
        },
        {
          sessionId: 'session1',
          filepath: 'file2.txt',
          content: Buffer.from('compressed2'),
          originalSize: 2000,
          compressedSize: 1000,
          compressionRatio: 0.5,
          checksum: 'checksum2',
          cachedAt: Date.now(),
          lastAccessed: Date.now(),
          accessCount: 5,
          ttl: 3600,
        },
      ];

      // Mock Redis keys and get
      const mockRedis = (cacheManager as any).redis;
      mockRedis.keys.mockResolvedValue(['key1', 'key2']);
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(mockEntries[0]))
        .mockResolvedValueOnce(JSON.stringify(mockEntries[1]));

      const stats = await cacheManager.getCacheStats();

      expect(stats).toBeDefined();
      expect(stats.totalFiles).toBe(2);
      expect(stats.totalSize).toBe(1500); // 500 + 1000
      expect(stats.compressionRatio).toBe(0.5);
      expect(stats.popularFiles).toHaveLength(2);
      expect(stats.popularFiles[0].accessCount).toBe(10); // Most popular first
    });
  });

  describe('Compression', () => {
    beforeEach(() => {
      cacheManager = createIntelligentCacheManager(config);
    });

    test('should compress content when above threshold', async () => {
      const content = Buffer.from('A'.repeat(5000)); // 5KB content

      const compressed = await (cacheManager as any).compressContent(content);

      expect(compressed).toBeDefined();
      expect(compressed.length).not.toBe(content.length); // Should be different due to compression
    });

    test('should not compress content below threshold', async () => {
      const content = Buffer.from('A'.repeat(1000)); // 1KB content

      const compressed = await (cacheManager as any).compressContent(content);

      expect(compressed).toBe(content); // Should return original content
    });

    test('should decompress content correctly', async () => {
      const compressed = Buffer.from('compressed_data');

      const decompressed = await (cacheManager as any).decompressContent(compressed);

      expect(decompressed).toBeDefined();
      expect(decompressed.toString()).toBe('decompressed');
    });
  });

  describe('Cache Priority Calculation', () => {
    beforeEach(() => {
      cacheManager = createIntelligentCacheManager(config);
    });

    test('should calculate high priority for popular, compressible files', () => {
      const pattern = {
        filepath: 'popular.txt',
        accessCount: 100,
        accessFrequency: 10,
        lastAccess: new Date(),
        averageAccessInterval: 360000,
        volatilityScore: 0.1,
        popularityScore: 0.9,
      };

      const priority = (cacheManager as any).calculateCachePriority(pattern, 10000, 5000);

      expect(priority).toBe('high');
    });

    test('should calculate medium priority for moderately popular files', () => {
      const pattern = {
        filepath: 'medium.txt',
        accessCount: 50,
        accessFrequency: 5,
        lastAccess: new Date(),
        averageAccessInterval: 720000,
        volatilityScore: 0.2,
        popularityScore: 0.5,
      };

      const priority = (cacheManager as any).calculateCachePriority(pattern, 20000, 15000);

      expect(priority).toBe('medium');
    });

    test('should calculate low priority for unpopular files', () => {
      const pattern = {
        filepath: 'unpopular.txt',
        accessCount: 5,
        accessFrequency: 0.5,
        lastAccess: new Date(),
        averageAccessInterval: 86400000,
        volatilityScore: 0.5,
        popularityScore: 0.1,
      };

      const priority = (cacheManager as any).calculateCachePriority(pattern, 50000, 40000);

      expect(priority).toBe('low');
    });
  });

  describe('Pattern Analysis', () => {
    beforeEach(() => {
      cacheManager = createIntelligentCacheManager(config);
    });

    test('should record access patterns', async () => {
      const sessionId = 'test-session';
      const filepath = 'test-file.txt';

      await (cacheManager as any).recordAccess(sessionId, filepath);

      const patternKey = `${sessionId}:${filepath}`;
      expect((cacheManager as any).accessPatterns.has(patternKey)).toBe(true);

      const pattern = (cacheManager as any).accessPatterns.get(patternKey);
      expect(pattern).toBeDefined();
      expect(pattern.filepath).toBe(filepath);
      expect(pattern.accessCount).toBe(1);
    });

    test('should update existing access patterns', async () => {
      const sessionId = 'test-session';
      const filepath = 'test-file.txt';

      // First access
      await (cacheManager as any).recordAccess(sessionId, filepath);

      // Second access
      await (cacheManager as any).recordAccess(sessionId, filepath);

      const pattern = (cacheManager as any).accessPatterns.get(`${sessionId}:${filepath}`);
      expect(pattern.accessCount).toBe(2);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      cacheManager = createIntelligentCacheManager(config);
    });

    test('should handle Redis connection errors gracefully', async () => {
      const mockRedis = (cacheManager as any).redis;
      mockRedis.get.mockRejectedValue(new Error('Redis connection failed'));

      const result = await cacheManager.getCachedFile('test-session', 'test-file.txt');

      expect(result).toBeNull();
    });

    test('should handle compression errors gracefully', async () => {
      const mockZlib = require('zlib');
      mockZlib.gzip.mockImplementation((data: Buffer, callback: Function) => {
        callback(new Error('Compression failed'), null);
      });

      const content = Buffer.from('A'.repeat(5000));
      const compressed = await (cacheManager as any).compressContent(content);

      expect(compressed).toBe(content); // Should return original content on compression failure
    });

    test('should handle decompression errors gracefully', async () => {
      const mockZlib = require('zlib');
      mockZlib.gunzip.mockImplementation((data: Buffer, callback: Function) => {
        callback(new Error('Decompression failed'), null);
      });

      const compressed = Buffer.from('compressed_data');
      const decompressed = await (cacheManager as any).decompressContent(compressed);

      expect(decompressed).toBe(compressed); // Should return compressed content on decompression failure
    });
  });

  describe('Event Emission', () => {
    beforeEach(() => {
      cacheManager = createIntelligentCacheManager(config);
    });

    test('should emit file cached events', async () => {
      const mockEmit = jest.fn();
      const originalEmit = cacheManager.emit;
      cacheManager.emit = mockEmit;

      const sessionId = 'test-session';
      const filepath = 'test-file.txt';
      const content = Buffer.from('test content');

      // Mock decision and Redis
      const mockDecision = jest.spyOn(cacheManager as any, 'shouldCacheFile');
      mockDecision.mockResolvedValue({
        shouldCache: true,
        priority: 'high',
        reason: 'Test',
        estimatedSize: 50,
        compressionSavings: 25,
      });

      const mockRedis = (cacheManager as any).redis;
      mockRedis.setEx.mockResolvedValue('OK');

      await cacheManager.cacheFile(sessionId, filepath, content);

      expect(mockEmit).toHaveBeenCalledWith('fileCached', expect.any(Object));

      cacheManager.emit = originalEmit;
    });

    test('should emit cache hit events', async () => {
      const mockEmit = jest.fn();
      const originalEmit = cacheManager.emit;
      cacheManager.emit = mockEmit;

      const cachedEntry = {
        sessionId: 'test-session',
        filepath: 'test-file.txt',
        content: Buffer.from('compressed'),
        originalSize: 100,
        compressedSize: 50,
        compressionRatio: 0.5,
        checksum: 'checksum',
        cachedAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 1,
        ttl: 3600,
      };

      const mockRedis = (cacheManager as any).redis;
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedEntry));
      mockRedis.setEx.mockResolvedValue('OK');

      await cacheManager.getCachedFile('test-session', 'test-file.txt');

      expect(mockEmit).toHaveBeenCalledWith('cacheHit', expect.any(Object));

      cacheManager.emit = originalEmit;
    });
  });

  describe('Resource Management', () => {
    test('should close Redis connection on cleanup', async () => {
      cacheManager = createIntelligentCacheManager(config);

      const mockRedis = (cacheManager as any).redis;
      mockRedis.quit.mockResolvedValue(undefined);

      await cacheManager.close();

      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});
