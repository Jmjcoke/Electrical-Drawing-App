import { FallbackService } from '../fallback.service';
import { FallbackOperationContext, defaultFallbackConfig } from '../fallback.types';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs/promises
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('FallbackService', () => {
  let fallbackService: FallbackService;
  let mockConfig: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    mockConfig = { ...defaultFallbackConfig };
    fallbackService = new FallbackService(mockConfig);
  });

  afterEach(() => {
    fallbackService.cleanup();
  });

  describe('Basic Functionality', () => {
    it('should execute successful primary operation without fallbacks', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const context: FallbackOperationContext = {
        operationType: 'test-operation',
        correlationId: 'test-123'
      };

      const result = await fallbackService.executeWithFallback(operation, context);

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.fallbackLevel).toBeNull();
      expect(result.cached).toBe(false);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should fallback when primary operation fails', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Primary operation failed'));
      const context: FallbackOperationContext = {
        operationType: 'file_access',
        correlationId: 'test-123',
        cacheKey: 'test-cache-key'
      };

      // Pre-populate cache for fallback
      await fallbackService.cacheResult('test-cache-key', 'cached-data', context);

      const result = await fallbackService.executeWithFallback(operation, context);

      expect(result.success).toBe(true);
      expect(result.data).toBe('cached-data');
      expect(result.fallbackLevel).toBe(1); // cache_read_through
      expect(result.cached).toBe(true);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should handle complete failure when all fallbacks exhausted', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Primary operation failed'));
      const context: FallbackOperationContext = {
        operationType: 'file_access',
        correlationId: 'test-123'
      };

      const result = await fallbackService.executeWithFallback(operation, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.fallbackLevel).toBeNull();
      expect(result.cached).toBe(false);
    });
  });

  describe('Cache Management', () => {
    it('should cache successful results for future use', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const context: FallbackOperationContext = {
        operationType: 'test-operation',
        cacheKey: 'test-cache-key',
        enableCaching: true,
        correlationId: 'test-123'
      };

      await fallbackService.executeWithFallback(operation, context);

      // Second call should use cached result
      const cachedOperation = jest.fn().mockRejectedValue(new Error('Should not be called'));
      const cachedResult = await fallbackService.executeWithFallback(cachedOperation, context);

      expect(cachedResult.success).toBe(true);
      expect(cachedResult.data).toBe('success');
      expect(cachedResult.cached).toBe(true);
      expect(cachedOperation).not.toHaveBeenCalled();
    });

    it('should respect cache TTL and expire entries', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const context: FallbackOperationContext = {
        operationType: 'test-operation',
        cacheKey: 'test-cache-key',
        enableCaching: true,
        cacheTTL: 100, // 100ms TTL
        correlationId: 'test-123'
      };

      await fallbackService.executeWithFallback(operation, context);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      const cachedOperation = jest.fn().mockRejectedValue(new Error('Should not be called'));
      const result = await fallbackService.executeWithFallback(cachedOperation, context);

      expect(result.success).toBe(false);
      expect(result.cached).toBe(false);
      expect(cachedOperation).not.toHaveBeenCalled(); // Not called because cache was expired
    });

    it('should invalidate cache entries', () => {
      const cacheKey = 'test-cache-key';
      expect(fallbackService.invalidateCache(cacheKey)).toBe(false); // Not found

      // Add entry
      fallbackService.cacheResult(cacheKey, 'test-data', {
        operationType: 'test',
        correlationId: 'test-123'
      });

      expect(fallbackService.invalidateCache(cacheKey)).toBe(true);
    });

    it('should clear cache by operation type', () => {
      const operationType = 'test-operation';

      // Add multiple entries
      fallbackService.cacheResult('key1', 'data1', {
        operationType,
        correlationId: 'test-123'
      });
      fallbackService.cacheResult('key2', 'data2', {
        operationType,
        correlationId: 'test-123'
      });
      fallbackService.cacheResult('key3', 'data3', {
        operationType: 'other-operation',
        correlationId: 'test-123'
      });

      const cleared = fallbackService.clearCacheByOperationType(operationType);
      expect(cleared).toBe(2);
    });
  });

  describe('Fallback Strategies', () => {
    describe('Cache Read-Through Fallback', () => {
      it('should successfully read from cache', async () => {
        const operation = jest.fn().mockRejectedValue(new Error('Primary failed'));
        const context: FallbackOperationContext = {
          operationType: 'file_access',
          cacheKey: 'test-cache-key',
          correlationId: 'test-123'
        };

        await fallbackService.cacheResult('test-cache-key', 'cached-data', context);

        const result = await fallbackService.executeWithFallback(operation, context);

        expect(result.success).toBe(true);
        expect(result.data).toBe('cached-data');
        expect(result.fallbackLevel).toBe(1);
      });
    });

    describe('Local Cache Fallback', () => {
      beforeEach(() => {
        mockFs.readFile.mockResolvedValue(JSON.stringify({ test: 'data' }));
      });

      it('should read from local cache file', async () => {
        const operation = jest.fn().mockRejectedValue(new Error('Primary failed'));
        const context: FallbackOperationContext = {
          operationType: 'file_access',
          path: '/test/path/file.txt',
          correlationId: 'test-123'
        };

        const result = await fallbackService.executeWithFallback(operation, context);

        expect(result.success).toBe(true);
        expect(result.data).toEqual({ test: 'data' });
        expect(result.fallbackLevel).toBe(2);
      });

      it('should handle local cache read errors', async () => {
        mockFs.readFile.mockRejectedValue(new Error('File not found'));
        const operation = jest.fn().mockRejectedValue(new Error('Primary failed'));
        const context: FallbackOperationContext = {
          operationType: 'file_access',
          path: '/test/path/file.txt',
          correlationId: 'test-123'
        };

        const result = await fallbackService.executeWithFallback(operation, context);

        expect(result.success).toBe(false);
        expect(result.fallbackLevel).toBeNull();
      });
    });

    describe('Stale-While-Revalidate Fallback', () => {
      it('should serve stale data immediately', async () => {
        const operation = jest.fn().mockRejectedValue(new Error('Primary failed'));
        const context: FallbackOperationContext = {
          operationType: 'file_access',
          cacheKey: 'test-cache-key',
          correlationId: 'test-123'
        };

        await fallbackService.cacheResult('test-cache-key', 'stale-data', context);

        const result = await fallbackService.executeWithFallback(operation, context);

        expect(result.success).toBe(true);
        expect(result.data).toBe('stale-data');
        expect(result.fallbackLevel).toBe(3); // stale_while_revalidate
      });
    });

    describe('Degraded Mode Fallback', () => {
      it('should provide degraded file response', async () => {
        const operation = jest.fn().mockRejectedValue(new Error('Primary failed'));
        const context: FallbackOperationContext = {
          operationType: 'file_access',
          correlationId: 'test-123'
        };

        const result = await fallbackService.executeWithFallback(operation, context);

        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('degraded', true);
        expect(result.data).toHaveProperty('message');
        expect(result.fallbackLevel).toBe(4); // degraded_mode
      });

      it('should provide degraded path response', async () => {
        const operation = jest.fn().mockRejectedValue(new Error('Primary failed'));
        const context: FallbackOperationContext = {
          operationType: 'session_path',
          sessionId: 'test-session',
          correlationId: 'test-123'
        };

        const result = await fallbackService.executeWithFallback(operation, context);

        expect(result.success).toBe(true);
        expect(typeof result.data).toBe('string');
        expect(result.data).toContain('fallback');
      });
    });

    describe('Alternative Path Resolution', () => {
      beforeEach(() => {
        mockFs.access.mockImplementation(async (path) => {
          if (path === '/alternative/path/file.txt') {
            return Promise.resolve();
          }
          throw new Error('Path not accessible');
        });
      });

      it('should resolve to alternative path', async () => {
        const operation = jest.fn().mockRejectedValue(new Error('Primary failed'));
        const context: FallbackOperationContext = {
          operationType: 'session_path',
          path: '/original/path/file.txt',
          correlationId: 'test-123'
        };

        const result = await fallbackService.executeWithFallback(operation, context);

        expect(result.success).toBe(true);
        expect(result.data).toBe('/alternative/path/file.txt');
        expect(result.fallbackLevel).toBe(2); // alternative_path_resolution
      });
    });
  });

  describe('Fallback Hierarchy Management', () => {
    it('should respect disabled fallback levels', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Primary failed'));
      const context: FallbackOperationContext = {
        operationType: 'file_access',
        disabledFallbackLevels: [1, 2, 3], // Disable cache levels
        correlationId: 'test-123'
      };

      const result = await fallbackService.executeWithFallback(operation, context);

      expect(result.success).toBe(true);
      expect(result.fallbackLevel).toBe(4); // Should skip to degraded mode
    });

    it('should respect minimum priority requirements', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Primary failed'));
      const context: FallbackOperationContext = {
        operationType: 'file_access',
        minPriority: 'high', // Only allow high priority fallbacks
        correlationId: 'test-123'
      };

      const result = await fallbackService.executeWithFallback(operation, context);

      expect(result.success).toBe(true);
      expect(result.fallbackLevel).toBe(1); // Only cache_read_through is high priority
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should track fallback statistics', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Primary failed'));
      const context: FallbackOperationContext = {
        operationType: 'test-stats',
        correlationId: 'test-123'
      };

      await fallbackService.executeWithFallback(operation, context);

      const stats = fallbackService.getFallbackStatistics('test-stats');
      expect(stats.totalFallbacks).toBeGreaterThan(0);
      expect(stats.successfulFallbacks).toBeGreaterThan(0);
    });

    it('should provide comprehensive statistics', () => {
      const stats = fallbackService.getFallbackStatistics();
      expect(stats).toBeInstanceOf(Map);
    });

    it('should handle non-existent operation type statistics', () => {
      const stats = fallbackService.getFallbackStatistics('non-existent');
      expect(stats).toBeDefined();
      expect(stats.totalFallbacks).toBe(0);
    });
  });

  describe('Event Emission', () => {
    it('should emit fallback used event', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Primary failed'));
      const context: FallbackOperationContext = {
        operationType: 'file_access',
        cacheKey: 'test-cache-key',
        correlationId: 'test-123'
      };

      await fallbackService.cacheResult('test-cache-key', 'cached-data', context);

      const eventSpy = jest.fn();
      fallbackService.on('fallbackUsed', eventSpy);

      await fallbackService.executeWithFallback(operation, context);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: expect.any(String),
          operationType: 'file_access',
          fallbackLevel: 1,
          strategy: 'cache_read_through',
          executionTime: expect.any(Number),
          correlationId: 'test-123'
        })
      );
    });

    it('should emit all fallbacks failed event', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Primary failed'));
      const context: FallbackOperationContext = {
        operationType: 'unknown_operation',
        correlationId: 'test-123'
      };

      const eventSpy = jest.fn();
      fallbackService.on('allFallbacksFailed', eventSpy);

      await fallbackService.executeWithFallback(operation, context);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          operationId: expect.any(String),
          operationType: 'unknown_operation',
          executionTime: expect.any(Number),
          lastError: 'Primary failed',
          correlationId: 'test-123'
        })
      );
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout slow primary operations', async () => {
      const slowOperation = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('slow-result'), 15000))
      );

      const context: FallbackOperationContext = {
        operationType: 'test-operation',
        correlationId: 'test-123'
      };

      const fastConfig = { ...mockConfig, primaryOperationTimeout: 100 };
      const fastFallbackService = new FallbackService(fastConfig);

      const result = await fastFallbackService.executeWithFallback(slowOperation, context);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timeout');

      fastFallbackService.cleanup();
    });

    it('should respect fallback level timeouts', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Primary failed'));
      const context: FallbackOperationContext = {
        operationType: 'file_access',
        correlationId: 'test-123'
      };

      // Mock slow cache operation
      const originalExecuteCache = fallbackService['executeCacheReadThroughFallback'];
      fallbackService['executeCacheReadThroughFallback'] = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('slow-cache'), 2000))
      );

      const result = await fallbackService.executeWithFallback(operation, context);

      // Should proceed to next fallback level due to timeout
      expect(result.success).toBe(true);
      expect(result.fallbackLevel).toBeGreaterThan(1);

      // Restore original method
      fallbackService['executeCacheReadThroughFallback'] = originalExecuteCache;
    });
  });

  describe('Resource Management', () => {
    it('should cleanup expired cache entries', async () => {
      const context: FallbackOperationContext = {
        operationType: 'test-cleanup',
        cacheKey: 'test-key',
        correlationId: 'test-123'
      };

      // Add entry with short TTL
      await fallbackService.cacheResult('test-key', 'test-data', context, 100);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Trigger cleanup (normally done by interval)
      fallbackService['cleanupExpiredCacheEntries']();

      // Verify entry was cleaned up
      const operation = jest.fn().mockRejectedValue(new Error('Should not use cache'));
      const result = await fallbackService.executeWithFallback(operation, context);

      expect(result.success).toBe(false);
    });

    it('should respect maximum cache entries limit', async () => {
      const smallConfig = { ...mockConfig, maxCacheEntries: 2 };
      const smallFallbackService = new FallbackService(smallConfig);

      const context: FallbackOperationContext = {
        operationType: 'test-limit',
        correlationId: 'test-123'
      };

      // Add entries beyond limit
      await smallFallbackService.cacheResult('key1', 'data1', { ...context, cacheKey: 'key1' });
      await smallFallbackService.cacheResult('key2', 'data2', { ...context, cacheKey: 'key2' });
      await smallFallbackService.cacheResult('key3', 'data3', { ...context, cacheKey: 'key3' });

      // Verify cleanup occurred (should have removed oldest entries)
      expect(smallFallbackService['fallbackCache'].size).toBeLessThanOrEqual(2);

      smallFallbackService.cleanup();
    });
  });

  describe('Error Handling', () => {
    it('should handle operation errors gracefully', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Test error'));
      const context: FallbackOperationContext = {
        operationType: 'file_access',
        correlationId: 'test-123'
      };

      const result = await fallbackService.executeWithFallback(operation, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Test error');
    });

    it('should handle malformed cache data', async () => {
      mockFs.readFile.mockResolvedValue('invalid json');

      const operation = jest.fn().mockRejectedValue(new Error('Primary failed'));
      const context: FallbackOperationContext = {
        operationType: 'file_access',
        path: '/test/path/file.txt',
        correlationId: 'test-123'
      };

      const result = await fallbackService.executeWithFallback(operation, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
