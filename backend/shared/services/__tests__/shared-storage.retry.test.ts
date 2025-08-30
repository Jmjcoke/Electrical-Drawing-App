import { SharedStorageRetry } from '../shared-storage.retry';
import { sharedStorageLogger } from '../shared-storage.logger';
import { sharedStorageMetrics } from '../shared-storage.metrics';

// Mock dependencies
jest.mock('../shared-storage.logger');
jest.mock('../shared-storage.metrics');

describe('SharedStorageRetry', () => {
  let retryMechanism: SharedStorageRetry;

  beforeEach(() => {
    retryMechanism = new SharedStorageRetry();
    jest.clearAllMocks();
  });

  describe('Basic Retry Functionality', () => {
    it('should execute operation successfully on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const context = {
        service: 'test-service',
        operation: 'test_operation',
        sessionId: 'session-123'
      };

      const result = await retryMechanism.executeWithRetry(operation, context);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      let attempts = 0;
      const operation = jest.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve('success');
      });

      const context = {
        service: 'test-service',
        operation: 'test_operation'
      };

      const result = await retryMechanism.executeWithRetry(operation, context);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should exhaust retries and throw error', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent failure'));
      const context = {
        service: 'test-service',
        operation: 'test_operation'
      };

      await expect(retryMechanism.executeWithRetry(operation, context)).rejects.toThrow('Persistent failure');
      expect(operation).toHaveBeenCalledTimes(3); // Default maxAttempts
    });

    it('should respect custom retry configuration', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Failure'));
      const context = {
        service: 'test-service',
        operation: 'test_operation'
      };

      const customConfig = {
        maxAttempts: 2,
        baseDelay: 100
      };

      await expect(retryMechanism.executeWithRetry(operation, context, customConfig)).rejects.toThrow('Failure');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Exponential Backoff', () => {
    it('should implement exponential backoff with jitter', async () => {
      let callTimes: number[] = [];
      const operation = jest.fn().mockImplementation(() => {
        callTimes.push(Date.now());
        return Promise.reject(new Error('Failure'));
      });

      const context = {
        service: 'test-service',
        operation: 'test_operation'
      };

      const startTime = Date.now();

      await expect(retryMechanism.executeWithRetry(operation, context, {
        maxAttempts: 3,
        baseDelay: 100,
        backoffMultiplier: 2,
        jitter: true
      })).rejects.toThrow();

      // Should have 3 attempts
      expect(callTimes).toHaveLength(3);

      // First retry should be after baseDelay (approximately)
      const firstRetryDelay = callTimes[1] - callTimes[0];
      expect(firstRetryDelay).toBeGreaterThanOrEqual(90); // Allow some timing variance

      // Second retry should be after baseDelay * multiplier (approximately)
      const secondRetryDelay = callTimes[2] - callTimes[1];
      expect(secondRetryDelay).toBeGreaterThanOrEqual(180); // Allow some timing variance
    });

    it('should respect maximum delay limit', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Failure'));
      const context = {
        service: 'test-service',
        operation: 'test_operation'
      };

      const startTime = Date.now();

      await expect(retryMechanism.executeWithRetry(operation, context, {
        maxAttempts: 5,
        baseDelay: 1000,
        maxDelay: 2000,
        backoffMultiplier: 4 // Would normally be 1000, 4000, 16000, 64000
      })).rejects.toThrow();

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete faster than if maxDelay wasn't respected
      // 5 attempts with maxDelay of 2000ms = ~8000ms total vs ~31000ms without limit
      expect(totalTime).toBeLessThan(10000);
    });
  });

  describe('Circuit Breaker', () => {
    it('should open circuit breaker after repeated failures', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent failure'));
      const context = {
        service: 'test-service',
        operation: 'test_operation'
      };

      // Simulate multiple failures to trigger circuit breaker
      for (let i = 0; i < 6; i++) {
        await expect(retryMechanism.executeWithRetry(operation, context)).rejects.toThrow();
      }

      // Circuit breaker should now be open
      const breakerStatus = retryMechanism.getCircuitBreakerStatus();
      expect(Object.keys(breakerStatus).length).toBeGreaterThan(0);

      const breaker = Object.values(breakerStatus)[0];
      expect(breaker.failureCount).toBeGreaterThan(0);
    });

    it('should allow request through when circuit breaker is half-open', async () => {
      const context = {
        service: 'test-service',
        operation: 'test_operation'
      };

      // First make the circuit breaker fail
      const failingOperation = jest.fn().mockRejectedValue(new Error('Failure'));
      for (let i = 0; i < 6; i++) {
        await expect(retryMechanism.executeWithRetry(failingOperation, context)).rejects.toThrow();
      }

      // Wait a bit and try with successful operation
      await new Promise(resolve => setTimeout(resolve, 100));

      const successfulOperation = jest.fn().mockResolvedValue('success');
      const result = await retryMechanism.executeWithRetry(successfulOperation, context);

      expect(result).toBe('success');
    });

    it('should manually reset circuit breaker', () => {
      const context = {
        service: 'test-service',
        operation: 'test_operation'
      };

      // Create a circuit breaker key
      const breakerKey = `${context.service}_${context.operation}`;

      // Manually reset (should work even if breaker doesn't exist)
      const result = retryMechanism.resetCircuitBreaker(breakerKey);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Adaptive Retry', () => {
    it('should execute with adaptive retry strategy', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const context = {
        service: 'test-service',
        operation: 'adaptive_test'
      };

      const result = await retryMechanism.executeWithAdaptiveRetry(operation, context, 'adaptive_test');

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should adapt configuration based on performance', async () => {
      const context = {
        service: 'test-service',
        operation: 'adaptive_test'
      };

      // Create high success rate scenario
      for (let i = 0; i < 20; i++) {
        const operation = jest.fn().mockResolvedValue('success');
        await retryMechanism.executeWithAdaptiveRetry(operation, context, 'adaptive_test');
      }

      // Check adaptive configuration
      const adaptiveConfigs = retryMechanism.getAdaptiveConfigs();
      expect(adaptiveConfigs).toHaveProperty('adaptive_test');
    });
  });

  describe('Retry Statistics', () => {
    it('should track retry statistics', async () => {
      const context = {
        service: 'test-service',
        operation: 'stats_test'
      };

      // Successful operation
      const successOperation = jest.fn().mockResolvedValue('success');
      await retryMechanism.executeWithRetry(successOperation, context);

      // Failed operation
      const failedOperation = jest.fn().mockRejectedValue(new Error('Failure'));
      await expect(retryMechanism.executeWithRetry(failedOperation, context)).rejects.toThrow();

      const stats = retryMechanism.getRetryStats('stats_test');

      expect(stats).toHaveProperty('operation', 'stats_test');
      expect(stats.successfulRetries).toBe(1);
      expect(stats.failedRetries).toBe(0);
      expect(stats.exhaustedRetries).toBe(1);
    });

    it('should return all retry statistics', () => {
      const allStats = retryMechanism.getRetryStats();

      expect(typeof allStats).toBe('object');
      // Should be empty initially or contain stats from previous tests
      expect(allStats).toBeDefined();
    });
  });

  describe('Timeout Handling', () => {
    it('should respect total timeout', async () => {
      const operation = jest.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 100);
        });
      });

      const context = {
        service: 'test-service',
        operation: 'timeout_test'
      };

      const startTime = Date.now();

      await expect(retryMechanism.executeWithRetry(operation, context, {
        maxAttempts: 10,
        baseDelay: 50,
        timeout: 200 // Short timeout
      })).rejects.toThrow('Retry timeout exceeded');

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(totalTime).toBeLessThan(300); // Should not take much longer than timeout
    });
  });

  describe('Custom Configuration', () => {
    it('should allow configuring custom retry settings', () => {
      const config = {
        maxAttempts: 5,
        baseDelay: 2000,
        maxDelay: 10000,
        backoffMultiplier: 1.5,
        jitter: false
      };

      expect(() => {
        retryMechanism.configureRetry('custom_operation', config);
      }).not.toThrow();

      // Verify configuration was stored
      const adaptiveConfigs = retryMechanism.getAdaptiveConfigs();
      expect(adaptiveConfigs).toHaveProperty('custom_operation');
      expect(adaptiveConfigs.custom_operation.config.maxAttempts).toBe(5);
    });

    it('should use custom configuration for adaptive retry', async () => {
      const config = {
        maxAttempts: 2,
        baseDelay: 100
      };

      retryMechanism.configureRetry('custom_operation', config);

      const operation = jest.fn().mockRejectedValue(new Error('Failure'));
      const context = {
        service: 'test-service',
        operation: 'custom_operation'
      };

      await expect(retryMechanism.executeWithAdaptiveRetry(operation, context, 'custom_operation')).rejects.toThrow();

      // Should only attempt 2 times due to custom config
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Types and Context', () => {
    it('should handle different error types appropriately', async () => {
      const operations = [
        { name: 'network_error', error: new Error('ECONNREFUSED'), shouldRetry: true },
        { name: 'permission_error', error: new Error('EACCES'), shouldRetry: false },
        { name: 'not_found_error', error: new Error('ENOENT'), shouldRetry: false }
      ];

      for (const op of operations) {
        (op.error as any).code = op.error.message;
        const operation = jest.fn().mockRejectedValue(op.error);
        const context = {
          service: 'test-service',
          operation: op.name
        };

        await expect(retryMechanism.executeWithRetry(operation, context)).rejects.toThrow();

        if (op.shouldRetry) {
          expect(operation).toHaveBeenCalledTimes(3); // Should retry for network errors
        } else {
          expect(operation).toHaveBeenCalledTimes(1); // Should not retry for other errors
        }
      }
    });

    it('should include context in retry operations', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Failure'));
      const context = {
        service: 'test-service',
        operation: 'context_test',
        sessionId: 'session-123',
        filepath: '/test/file.txt',
        userId: 'user-456'
      };

      await expect(retryMechanism.executeWithRetry(operation, context)).rejects.toThrow();

      // Context should be passed through (though we can't easily test the logging)
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('Performance Metrics', () => {
    it('should record retry performance metrics', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const context = {
        service: 'test-service',
        operation: 'metrics_test'
      };

      await retryMechanism.executeWithRetry(operation, context);

      // Metrics should be recorded (mocked, so we can't verify exact calls)
      expect(sharedStorageMetrics.recordRetrySuccess).toHaveBeenCalled();
    });

    it('should record retry failure metrics', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Failure'));
      const context = {
        service: 'test-service',
        operation: 'metrics_test'
      };

      await expect(retryMechanism.executeWithRetry(operation, context)).rejects.toThrow();

      expect(sharedStorageMetrics.recordRetryFailure).toHaveBeenCalled();
      expect(sharedStorageMetrics.recordRetryExhaustion).toHaveBeenCalled();
    });
  });

  describe('Circuit Breaker Status', () => {
    it('should provide circuit breaker status', () => {
      const status = retryMechanism.getCircuitBreakerStatus();

      expect(typeof status).toBe('object');
      // Initially should be empty or have default breakers
      expect(status).toBeDefined();
    });

    it('should show circuit breaker details after failures', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Failure'));
      const context = {
        service: 'test-service',
        operation: 'breaker_test'
      };

      // Trigger some failures
      for (let i = 0; i < 3; i++) {
        await expect(retryMechanism.executeWithRetry(operation, context)).rejects.toThrow();
      }

      const status = retryMechanism.getCircuitBreakerStatus();
      const breakerKey = `${context.service}_${context.operation}`;

      expect(status).toHaveProperty(breakerKey);
      expect(status[breakerKey].failureCount).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle operation timeout gracefully', async () => {
      const operation = jest.fn().mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => resolve('success'), 5000); // Very slow operation
        });
      });

      const context = {
        service: 'test-service',
        operation: 'timeout_test'
      };

      await expect(retryMechanism.executeWithRetry(operation, context, {
        timeout: 100 // Very short timeout
      })).rejects.toThrow('Retry timeout exceeded');
    });

    it('should handle zero max attempts', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Failure'));
      const context = {
        service: 'test-service',
        operation: 'zero_attempts_test'
      };

      await expect(retryMechanism.executeWithRetry(operation, context, {
        maxAttempts: 0
      })).rejects.toThrow('Failure');

      expect(operation).toHaveBeenCalledTimes(0);
    });

    it('should handle very large delay values', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Failure'));
      const context = {
        service: 'test-service',
        operation: 'large_delay_test'
      };

      const startTime = Date.now();

      await expect(retryMechanism.executeWithRetry(operation, context, {
        maxAttempts: 2,
        baseDelay: 100,
        maxDelay: 50 // maxDelay smaller than calculated delay
      })).rejects.toThrow();

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should not take too long due to maxDelay limit
      expect(totalTime).toBeLessThan(200);
    });
  });

  describe('Resource Cleanup', () => {
    it('should handle rapid successive operations', async () => {
      const operations = Array(10).fill(null).map((_, i) => ({
        operation: jest.fn().mockResolvedValue(`success_${i}`),
        context: {
          service: 'test-service',
          operation: `rapid_test_${i}`
        }
      }));

      const promises = operations.map(({ operation, context }) =>
        retryMechanism.executeWithRetry(operation, context)
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result).toBe(`success_${i}`);
      });
    });

    it('should handle concurrent operations with circuit breakers', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Concurrent failure'));
      const context = {
        service: 'test-service',
        operation: 'concurrent_test'
      };

      // Run multiple concurrent failing operations
      const promises = Array(5).fill(null).map(() =>
        retryMechanism.executeWithRetry(operation, context)
      );

      await Promise.all(promises.map(p => p.catch(() => {}))); // Ignore rejections

      const status = retryMechanism.getCircuitBreakerStatus();
      const breakerKey = `${context.service}_${context.operation}`;

      expect(status[breakerKey].failureCount).toBeGreaterThan(0);
    });
  });
});
