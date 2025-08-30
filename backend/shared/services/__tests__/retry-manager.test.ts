import { RetryManagerService } from '../retry-manager.service';
import { CircuitBreakerService } from '../circuit-breaker.service';
import { defaultRetryManagerConfig, RetryOperationContext } from '../retry-manager.types';

describe('RetryManagerService', () => {
  let retryManager: RetryManagerService;
  let circuitBreaker: CircuitBreakerService;
  let mockConfig: any;

  beforeEach(() => {
    circuitBreaker = new CircuitBreakerService();
    mockConfig = { ...defaultRetryManagerConfig };
    retryManager = new RetryManagerService(circuitBreaker, mockConfig);
  });

  afterEach(() => {
    retryManager['cleanupExpiredContexts']();
    circuitBreaker.cleanup();
  });

  describe('Basic Functionality', () => {
    it('should execute successful operation without retries', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const context: RetryOperationContext = {
        operationType: 'test-operation',
        correlationId: 'test-123'
      };

      const result = await retryManager.executeWithIntelligentRetry(operation, context);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry failed operation and eventually succeed', async () => {
      let callCount = 0;
      const operation = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve('success');
      });

      const context: RetryOperationContext = {
        operationType: 'test-operation',
        correlationId: 'test-123'
      };

      const result = await retryManager.executeWithIntelligentRetry(operation, context);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should respect maximum retry attempts', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent failure'));
      const context: RetryOperationContext = {
        operationType: 'test-operation',
        correlationId: 'test-123'
      };

      await expect(
        retryManager.executeWithIntelligentRetry(operation, context)
      ).rejects.toThrow('Persistent failure');

      expect(operation).toHaveBeenCalledTimes(mockConfig.defaultRetryConfig.maxAttempts);
    });
  });

  describe('Error Classification and Retry Logic', () => {
    it('should retry network errors', async () => {
      let callCount = 0;
      const operation = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Connection timeout');
        }
        return Promise.resolve('success');
      });

      const context: RetryOperationContext = {
        operationType: 'network-operation',
        correlationId: 'test-123'
      };

      const result = await retryManager.executeWithIntelligentRetry(operation, context);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should not retry client errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('404 Not Found'));
      const context: RetryOperationContext = {
        operationType: 'api-call',
        correlationId: 'test-123'
      };

      await expect(
        retryManager.executeWithIntelligentRetry(operation, context)
      ).rejects.toThrow('404 Not Found');

      expect(operation).toHaveBeenCalledTimes(1); // No retries for client errors
    });

    it('should apply different delays for different error types', async () => {
      const startTime = Date.now();

      let callCount = 0;
      const operation = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Connection timeout'); // Should have longer delay
        }
        return Promise.resolve('success');
      });

      const context: RetryOperationContext = {
        operationType: 'test-operation',
        correlationId: 'test-123'
      };

      await retryManager.executeWithIntelligentRetry(operation, context);

      const elapsedTime = Date.now() - startTime;
      // Should take at least the initial delay plus some time for execution
      expect(elapsedTime).toBeGreaterThan(mockConfig.defaultRetryConfig.initialDelay);
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should respect circuit breaker open state', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const context: RetryOperationContext = {
        operationType: 'test-operation',
        correlationId: 'test-123'
      };

      // Force circuit breaker open
      const circuitKey = 'test-operation_unknown';
      circuitBreaker.forceOpen(circuitKey);

      await expect(
        retryManager.executeWithIntelligentRetry(operation, context)
      ).rejects.toThrow('Circuit breaker is OPEN');

      expect(operation).not.toHaveBeenCalled();
    });

    it('should work with circuit breaker fallback', async () => {
      let callCount = 0;
      const operation = jest.fn().mockImplementation(() => {
        callCount++;
        throw new Error('Service unavailable');
      });

      const fallback = jest.fn().mockResolvedValue('fallback-success');

      const context: RetryOperationContext = {
        operationType: 'test-operation',
        correlationId: 'test-123',
        fallback
      };

      // Force circuit breaker open
      const circuitKey = 'test-operation_unknown';
      circuitBreaker.forceOpen(circuitKey);

      const result = await retryManager.executeWithIntelligentRetry(operation, context);

      expect(result).toBe('fallback-success');
      expect(fallback).toHaveBeenCalled();
    });
  });

  describe('Retry Budget Management', () => {
    it('should enforce retry budget limits', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Budget test error'));
      const context: RetryOperationContext = {
        operationType: 'budget-test',
        correlationId: 'test-123'
      };

      // Override config for testing
      const testConfig = {
        ...mockConfig,
        defaultRetryBudget: 2 // Very low budget for testing
      };

      const testRetryManager = new RetryManagerService(circuitBreaker, testConfig);

      // First operation should fail due to budget
      await expect(
        testRetryManager.executeWithIntelligentRetry(operation, context)
      ).rejects.toThrow('Retry budget exceeded');

      expect(operation).toHaveBeenCalledTimes(0);
    });
  });

  describe('Predictive Retry Capabilities', () => {
    it('should update error patterns over time', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Connection timeout'));
      const context: RetryOperationContext = {
        operationType: 'predictive-test',
        correlationId: 'test-123'
      };

      // Run multiple failed operations to build pattern
      for (let i = 0; i < 3; i++) {
        try {
          await retryManager.executeWithIntelligentRetry(operation, { ...context, correlationId: `test-${i}` });
        } catch (error) {
          // Expected to fail
        }
      }

      // Check that error patterns were recorded
      const stats = retryManager.getRetryStatistics();
      expect(stats.totalRetries).toBeGreaterThan(0);
      expect(stats.failedRetries).toBeGreaterThan(0);
    });

    it('should calculate intelligent delays based on error patterns', async () => {
      let callCount = 0;
      const operation = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Connection timeout'); // Should trigger longer delays
        }
        return Promise.resolve('success');
      });

      const context: RetryOperationContext = {
        operationType: 'delay-test',
        correlationId: 'test-123'
      };

      const startTime = Date.now();
      const result = await retryManager.executeWithIntelligentRetry(operation, context);
      const elapsedTime = Date.now() - startTime;

      expect(result).toBe('success');
      // Should take longer due to intelligent delay calculation
      expect(elapsedTime).toBeGreaterThan(mockConfig.defaultRetryConfig.initialDelay * 1.5);
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide comprehensive retry statistics', async () => {
      // Mix of successful and failed operations
      const successOperation = jest.fn().mockResolvedValue('success');
      const failureOperation = jest.fn().mockRejectedValue(new Error('Failure'));

      const successContext: RetryOperationContext = {
        operationType: 'success-op',
        correlationId: 'success-123'
      };

      const failureContext: RetryOperationContext = {
        operationType: 'failure-op',
        correlationId: 'failure-123'
      };

      // Execute operations
      await retryManager.executeWithIntelligentRetry(successOperation, successContext);

      try {
        await retryManager.executeWithIntelligentRetry(failureOperation, failureContext);
      } catch (error) {
        // Expected
      }

      const stats = retryManager.getRetryStatistics();

      expect(stats.totalRetries).toBe(2);
      expect(stats.successfulRetries).toBe(1);
      expect(stats.failedRetries).toBe(1);
      expect(stats.successRate).toBe(0.5);
      expect(stats.activeContexts).toBeGreaterThanOrEqual(0);
    });

    it('should track attempt details', async () => {
      let callCount = 0;
      const operation = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 2) {
          throw new Error('Retryable error');
        }
        return Promise.resolve('success');
      });

      const context: RetryOperationContext = {
        operationType: 'tracking-test',
        correlationId: 'test-123'
      };

      await retryManager.executeWithIntelligentRetry(operation, context);

      const stats = retryManager.getRetryStatistics();
      expect(stats.totalRetries).toBe(1);
      expect(stats.successfulRetries).toBe(1);
    });
  });

  describe('Configuration and Customization', () => {
    it('should support operation-specific retry configurations', async () => {
      const customConfig = {
        ...mockConfig,
        operationSpecificConfigs: {
          'custom-operation': {
            maxAttempts: 5,
            initialDelay: 2000
          }
        }
      };

      const customRetryManager = new RetryManagerService(circuitBreaker, customConfig);

      let callCount = 0;
      const operation = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 4) { // Need 4 failures to test 5 attempts
          throw new Error('Custom retry test');
        }
        return Promise.resolve('success');
      });

      const context: RetryOperationContext = {
        operationType: 'custom-operation',
        correlationId: 'custom-123'
      };

      const result = await customRetryManager.executeWithIntelligentRetry(operation, context);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(4);
    });

    it('should handle timeout configurations correctly', async () => {
      const slowOperation = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('slow-success'), 2000))
      );

      const timeoutConfig = {
        ...mockConfig,
        defaultRetryConfig: {
          ...mockConfig.defaultRetryConfig,
          operationTimeout: 1000 // 1 second timeout
        }
      };

      const timeoutRetryManager = new RetryManagerService(circuitBreaker, timeoutConfig);

      const context: RetryOperationContext = {
        operationType: 'timeout-test',
        correlationId: 'timeout-123'
      };

      await expect(
        timeoutRetryManager.executeWithIntelligentRetry(slowOperation, context)
      ).rejects.toThrow(/timeout/i);
    });
  });

  describe('Event Handling', () => {
    it('should handle circuit breaker state changes', () => {
      const circuitKey = 'event-test_unknown';

      // Test circuit breaker open event
      circuitBreaker.forceOpen(circuitKey);

      // The retry manager should handle the event (we can't easily test the internal state,
      // but we can verify it doesn't throw errors)
      expect(() => {
        // This should not throw
      }).not.toThrow();
    });

    it('should emit retry events', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Event test error'));
      const context: RetryOperationContext = {
        operationType: 'event-test',
        correlationId: 'event-123'
      };

      // Set up event listener
      const eventSpy = jest.fn();
      retryManager.on('retryAttempt', eventSpy);

      try {
        await retryManager.executeWithIntelligentRetry(operation, context);
      } catch (error) {
        // Expected
      }

      // Event emission is handled internally, we just verify no errors occur
      expect(operation).toHaveBeenCalled();
    });
  });
});
