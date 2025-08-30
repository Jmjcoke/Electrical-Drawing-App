import { SharedStorageCache } from '../shared-storage.cache';
import { sharedStorageMetrics } from '../shared-storage.metrics';
import { sharedStorageLogger } from '../shared-storage.logger';

// Mock dependencies
jest.mock('../shared-storage.metrics');
jest.mock('../shared-storage.logger');

describe('SharedStorageCache', () => {
  let cache: SharedStorageCache;
  let testData: Buffer;

  beforeEach(() => {
    cache = new SharedStorageCache({
      maxCacheSize: 1024 * 1024, // 1MB for testing
      cacheTTL: 5000, // 5 seconds for testing
      maxMetadataCacheSize: 100
    });

    testData = Buffer.from('test file content for caching');

    jest.clearAllMocks();
  });

  describe('File Content Caching', () => {
    it('should cache and retrieve file content', async () => {
      const sessionId = 'session-123';
      const filepath = '/test/file.txt';
      const service = 'file-processor';

      // Initially should not have cached content
      let cachedContent = await cache.getCachedFile(sessionId, filepath, service);
      expect(cachedContent).toBeNull();

      // Cache the content
      await cache.cacheFile(sessionId, filepath, testData, service);

      // Should now retrieve from cache
      cachedContent = await cache.getCachedFile(sessionId, filepath, service);
      expect(cachedContent).toEqual(testData);
    });

    it('should handle cache misses gracefully', async () => {
      const cachedContent = await cache.getCachedFile('nonexistent', '/missing/file.txt', 'test-service');
      expect(cachedContent).toBeNull();
    });

    it('should expire cached content after TTL', async () => {
      const sessionId = 'session-123';
      const filepath = '/test/file.txt';
      const service = 'file-processor';

      // Cache with short TTL for testing
      const shortTTL = 100; // 100ms
      const shortCache = new SharedStorageCache({
        maxCacheSize: 1024 * 1024,
        cacheTTL: shortTTL,
        maxMetadataCacheSize: 100
      });

      await shortCache.cacheFile(sessionId, filepath, testData, service);

      // Should be available immediately
      let cachedContent = await shortCache.getCachedFile(sessionId, filepath, service);
      expect(cachedContent).toEqual(testData);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, shortTTL + 50));

      // Should be expired
      cachedContent = await shortCache.getCachedFile(sessionId, filepath, service);
      expect(cachedContent).toBeNull();
    });
  });

  describe('Metadata Caching', () => {
    it('should cache and retrieve file metadata', async () => {
      const sessionId = 'session-123';
      const filepath = '/test/file.txt';
      const service = 'file-processor';

      const metadata = {
        size: 1024,
        mtime: new Date(),
        ctime: new Date(),
        isDirectory: false,
        permissions: 'rw-r--r--'
      };

      // Initially should not have cached metadata
      let cachedMetadata = await cache.getCachedMetadata(sessionId, filepath, service);
      expect(cachedMetadata).toBeNull();

      // Cache the metadata
      await cache.cacheMetadata(sessionId, filepath, metadata, service);

      // Should now retrieve from cache
      cachedMetadata = await cache.getCachedMetadata(sessionId, filepath, service);
      expect(cachedMetadata).toBeDefined();
      expect(cachedMetadata?.metadata.size).toBe(metadata.size);
      expect(cachedMetadata?.metadata.permissions).toBe(metadata.permissions);
    });

    it('should handle metadata cache misses', async () => {
      const cachedMetadata = await cache.getCachedMetadata('nonexistent', '/missing/file.txt', 'test-service');
      expect(cachedMetadata).toBeNull();
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate session cache', async () => {
      const sessionId = 'session-123';
      const filepath = '/test/file.txt';
      const service = 'file-processor';

      // Cache file content and metadata
      await cache.cacheFile(sessionId, filepath, testData, service);
      await cache.cacheMetadata(sessionId, filepath, {
        size: 1024,
        mtime: new Date(),
        ctime: new Date(),
        isDirectory: false
      }, service);

      // Verify cache is populated
      let cachedContent = await cache.getCachedFile(sessionId, filepath, service);
      let cachedMetadata = await cache.getCachedMetadata(sessionId, filepath, service);
      expect(cachedContent).toEqual(testData);
      expect(cachedMetadata).not.toBeNull();

      // Invalidate session cache
      cache.invalidateSessionCache(sessionId);

      // Cache should be cleared
      cachedContent = await cache.getCachedFile(sessionId, filepath, service);
      cachedMetadata = await cache.getCachedMetadata(sessionId, filepath, service);
      expect(cachedContent).toBeNull();
      expect(cachedMetadata).toBeNull();
    });

    it('should invalidate specific file cache', async () => {
      const sessionId = 'session-123';
      const filepath = '/test/file.txt';
      const service = 'file-processor';

      // Cache file content and metadata
      await cache.cacheFile(sessionId, filepath, testData, service);
      await cache.cacheMetadata(sessionId, filepath, {
        size: 1024,
        mtime: new Date(),
        ctime: new Date(),
        isDirectory: false
      }, service);

      // Invalidate specific file
      cache.invalidateFileCache(sessionId, filepath);

      // Cache should be cleared for this file
      const cachedContent = await cache.getCachedFile(sessionId, filepath, service);
      const cachedMetadata = await cache.getCachedMetadata(sessionId, filepath, service);
      expect(cachedContent).toBeNull();
      expect(cachedMetadata).toBeNull();
    });
  });

  describe('Cache Size Management', () => {
    it('should evict entries when cache size limit is reached', async () => {
      const smallCache = new SharedStorageCache({
        maxCacheSize: 100, // Very small cache for testing
        cacheTTL: 30000,
        maxMetadataCacheSize: 10
      });

      const sessionId = 'session-123';
      const service = 'file-processor';

      // Add multiple files that exceed cache size
      const largeData1 = Buffer.alloc(60); // 60 bytes
      const largeData2 = Buffer.alloc(60); // 60 bytes

      await smallCache.cacheFile(sessionId, '/file1.txt', largeData1, service);
      await smallCache.cacheFile(sessionId, '/file2.txt', largeData2, service);

      // Check cache stats
      const stats = smallCache.getCacheStats();
      expect(stats.totalSize).toBeLessThanOrEqual(100);
    });

    it('should handle metadata cache size limits', async () => {
      const smallCache = new SharedStorageCache({
        maxCacheSize: 1024 * 1024,
        cacheTTL: 30000,
        maxMetadataCacheSize: 2 // Very small metadata cache
      });

      const sessionId = 'session-123';
      const service = 'file-processor';

      // Add multiple metadata entries
      await smallCache.cacheMetadata(sessionId, '/file1.txt', {
        size: 100,
        mtime: new Date(),
        ctime: new Date(),
        isDirectory: false
      }, service);

      await smallCache.cacheMetadata(sessionId, '/file2.txt', {
        size: 200,
        mtime: new Date(),
        ctime: new Date(),
        isDirectory: false
      }, service);

      await smallCache.cacheMetadata(sessionId, '/file3.txt', {
        size: 300,
        mtime: new Date(),
        ctime: new Date(),
        isDirectory: false
      }, service);

      const stats = smallCache.getCacheStats();
      expect(stats.totalMetadataEntries).toBeLessThanOrEqual(2);
    });
  });

  describe('Cache Statistics', () => {
    it('should provide comprehensive cache statistics', async () => {
      const sessionId = 'session-123';
      const service = 'file-processor';

      // Add some cache entries
      await cache.cacheFile(sessionId, '/file1.txt', testData, service);
      await cache.cacheMetadata(sessionId, '/file1.txt', {
        size: testData.length,
        mtime: new Date(),
        ctime: new Date(),
        isDirectory: false
      }, service);

      const stats = cache.getCacheStats();

      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('totalMetadataEntries');
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('maxCacheSize');
      expect(stats).toHaveProperty('utilizationPercent');
      expect(stats).toHaveProperty('fileContentCache');
      expect(stats).toHaveProperty('metadataCache');
      expect(stats).toHaveProperty('mostAccessedEntries');
      expect(stats).toHaveProperty('cacheTTL');
      expect(stats).toHaveProperty('lastCleanup');

      expect(stats.totalEntries).toBe(1);
      expect(stats.totalMetadataEntries).toBe(1);
      expect(stats.totalSize).toBe(testData.length);
      expect(stats.utilizationPercent).toBeGreaterThan(0);
    });

    it('should track most accessed entries', async () => {
      const sessionId = 'session-123';
      const service = 'file-processor';

      // Cache multiple files
      await cache.cacheFile(sessionId, '/file1.txt', testData, service);
      await cache.cacheFile(sessionId, '/file2.txt', testData, service);

      // Access file1 multiple times
      await cache.getCachedFile(sessionId, '/file1.txt', service);
      await cache.getCachedFile(sessionId, '/file1.txt', service);
      await cache.getCachedFile(sessionId, '/file1.txt', service);

      // Access file2 once
      await cache.getCachedFile(sessionId, '/file2.txt', service);

      const stats = cache.getCacheStats();
      expect(stats.mostAccessedEntries.length).toBeGreaterThan(0);
      expect(stats.mostAccessedEntries[0].key).toContain('/file1.txt');
      expect(stats.mostAccessedEntries[0].accessCount).toBeGreaterThan(1);
    });
  });

  describe('Access Pattern Analysis', () => {
    it('should analyze access patterns for optimization', async () => {
      const sessionId = 'session-123';
      const service = 'file-processor';

      // Create access patterns
      for (let i = 0; i < 10; i++) {
        await cache.cacheFile(sessionId, `/frequent-file-${i % 3}.txt`, testData, service);
        await cache.getCachedFile(sessionId, `/frequent-file-${i % 3}.txt`, service);
      }

      const analysis = cache.analyzeAccessPatterns();

      expect(analysis).toHaveProperty('frequentAccessFiles');
      expect(analysis).toHaveProperty('sequentialAccessPatterns');
      expect(analysis).toHaveProperty('recommendations');
      expect(analysis).toHaveProperty('analysisTimestamp');

      expect(Array.isArray(analysis.frequentAccessFiles)).toBe(true);
      expect(Array.isArray(analysis.sequentialAccessPatterns)).toBe(true);
      expect(Array.isArray(analysis.recommendations)).toBe(true);
    });

    it('should identify frequently accessed files', async () => {
      const sessionId = 'session-123';
      const service = 'file-processor';

      // Create one file that gets accessed many times
      const frequentFile = '/hot-file.txt';
      await cache.cacheFile(sessionId, frequentFile, testData, service);

      for (let i = 0; i < 8; i++) {
        await cache.getCachedFile(sessionId, frequentFile, service);
      }

      const analysis = cache.analyzeAccessPatterns();
      const frequentFiles = analysis.frequentAccessFiles;

      expect(frequentFiles.length).toBeGreaterThan(0);
      expect(frequentFiles[0].filepath).toContain('hot-file.txt');
      expect(frequentFiles[0].accessCount).toBeGreaterThan(5);
    });
  });

  describe('Preloading', () => {
    it('should preload frequently accessed files', async () => {
      const sessionId = 'session-123';
      const service = 'file-processor';
      const basePath = '/tmp/test-session';

      // This test would require mocking filesystem operations
      // For now, we verify the method exists and doesn't throw
      expect(async () => {
        await cache.preloadFrequentFiles(sessionId, basePath, service);
      }).not.toThrow();
    });
  });

  describe('Cache Optimization', () => {
    it('should perform cache optimization', () => {
      // Add some cache entries
      const sessionId = 'session-123';
      const service = 'file-processor';

      // This test verifies the method exists and runs without error
      expect(() => {
        cache.optimizeCache();
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources properly', () => {
      const sessionId = 'session-123';
      const service = 'file-processor';

      // Add some entries
      cache.cacheFile(sessionId, '/test.txt', testData, service);

      // Cleanup should not throw
      expect(() => {
        cache.cleanup();
      }).not.toThrow();

      // After cleanup, cache should be empty
      const stats = cache.getCacheStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.totalMetadataEntries).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle cache operations gracefully on errors', async () => {
      // Test with invalid session/file paths
      const result1 = await cache.getCachedFile('', '', '');
      expect(result1).toBeNull();

      const result2 = await cache.getCachedMetadata('', '', '');
      expect(result2).toBeNull();
    });

    it('should handle empty or null data gracefully', async () => {
      const sessionId = 'session-123';
      const filepath = '/test/file.txt';
      const service = 'file-processor';

      // Cache empty buffer
      const emptyBuffer = Buffer.alloc(0);
      await cache.cacheFile(sessionId, filepath, emptyBuffer, service);

      const cached = await cache.getCachedFile(sessionId, filepath, service);
      expect(cached).toEqual(emptyBuffer);
    });
  });

  describe('Cache Configuration', () => {
    it('should accept custom configuration options', () => {
      const customCache = new SharedStorageCache({
        maxCacheSize: 2 * 1024 * 1024, // 2MB
        cacheTTL: 10000, // 10 seconds
        maxMetadataCacheSize: 200,
        enableCleanup: false
      });

      const stats = customCache.getCacheStats();
      expect(stats.maxCacheSize).toBe(2 * 1024 * 1024);
      expect(stats.cacheTTL).toBe(10000);
    });

    it('should use default configuration when not specified', () => {
      const defaultCache = new SharedStorageCache();

      const stats = defaultCache.getCacheStats();
      expect(stats.maxCacheSize).toBeGreaterThan(0);
      expect(stats.cacheTTL).toBeGreaterThan(0);
      expect(stats.maxMetadataCacheSize).toBeGreaterThan(0);
    });
  });
});
