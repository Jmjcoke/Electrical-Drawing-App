/**
 * Unit tests for CircuitBreaker
 */

import {
  CircuitBreaker,
  CircuitBreakerState,
  CircuitBreakerConfig,
  CircuitBreakerOpenError,
  CircuitBreakerFactory,
  CircuitBreakerManager
} from '../../reliability/CircuitBreaker';

describe('CircuitBreaker', () => {
  let config: CircuitBreakerConfig;
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    config = {
      failureThreshold: 0.5, // 50% failure rate
      recoveryTimeout: 1000, // 1 second
      halfOpenMaxRequests: 2,
      timeout: 500,
      monitoringWindow: 5000, // 5 seconds
      minimumRequests: 3
    };
    circuitBreaker = new CircuitBreaker(config, 'test-breaker');
  });

  describe('Configuration Validation', () => {
    it('should accept valid configuration', () => {
      expect(() => new CircuitBreaker(config)).not.toThrow();
    });

    it('should reject invalid failure threshold', () => {
      const invalidConfig = { ...config, failureThreshold: 1.5 };
      expect(() => new CircuitBreaker(invalidConfig))
        .toThrow('Failure threshold must be between 0 and 1');
    });

    it('should reject negative recovery timeout', () => {
      const invalidConfig = { ...config, recoveryTimeout: -1000 };
      expect(() => new CircuitBreaker(invalidConfig))
        .toThrow('Recovery timeout must be positive');
    });

    it('should reject zero minimum requests', () => {
      const invalidConfig = { ...config, minimumRequests: 0 };
      expect(() => new CircuitBreaker(invalidConfig))
        .toThrow('Minimum requests must be positive');
    });
  });

  describe('Circuit Breaker States', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should allow execution in CLOSED state', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await circuitBreaker.execute(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should transition to OPEN on repeated failures', async () => {
      const failingOperation = jest.fn().mockRejectedValue(new Error('failure'));

      // Execute enough failures to meet minimum requests and failure threshold
      for (let i = 0; i < 4; i++) {
        try {
          await circuitBreaker.execute(failingOperation);
        } catch (error) {
          // Expected failures
        }
      }

      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should reject requests immediately in OPEN state', async () => {
      // Force circuit breaker to OPEN state
      circuitBreaker.forceState(CircuitBreakerState.OPEN);

      const operation = jest.fn().mockResolvedValue('success');
      
      await expect(circuitBreaker.execute(operation))
        .rejects.toThrow(CircuitBreakerOpenError);
      
      expect(operation).not.toHaveBeenCalled();
    });

    it('should transition to HALF_OPEN after recovery timeout', async () => {
      // Force to OPEN state
      circuitBreaker.forceState(CircuitBreakerState.OPEN);
      
      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));
      
      // Should transition to HALF_OPEN on next state check
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
    });

    it('should allow limited requests in HALF_OPEN state', async () => {
      circuitBreaker.forceState(CircuitBreakerState.HALF_OPEN);
      
      const successOperation = jest.fn().mockResolvedValue('success');
      
      // Should allow requests up to halfOpenMaxRequests
      await circuitBreaker.execute(successOperation);
      await circuitBreaker.execute(successOperation);
      
      expect(successOperation).toHaveBeenCalledTimes(2);
    });

    it('should transition back to CLOSED after successful HALF_OPEN requests', async () => {
      circuitBreaker.forceState(CircuitBreakerState.HALF_OPEN);
      
      const successOperation = jest.fn().mockResolvedValue('success');
      
      // Execute successful requests to close circuit
      await circuitBreaker.execute(successOperation);
      await circuitBreaker.execute(successOperation);
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should transition back to OPEN on failure in HALF_OPEN state', async () => {
      circuitBreaker.forceState(CircuitBreakerState.HALF_OPEN);
      
      const failingOperation = jest.fn().mockRejectedValue(new Error('failure'));
      
      try {
        await circuitBreaker.execute(failingOperation);
      } catch (error) {
        // Expected failure
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });
  });

  describe('Request Timeout', () => {
    it('should timeout long-running operations', async () => {
      const slowOperation = () => new Promise(resolve => 
        setTimeout(resolve, 1000) // Longer than timeout
      );

      await expect(circuitBreaker.execute(slowOperation))
        .rejects.toThrow('Circuit breaker timeout after 500ms');
    });

    it('should not timeout fast operations', async () => {
      const fastOperation = () => new Promise(resolve => resolve('fast'));

      const result = await circuitBreaker.execute(fastOperation);
      expect(result).toBe('fast');
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should track request metrics', async () => {
      const successOperation = jest.fn().mockResolvedValue('success');
      const failOperation = jest.fn().mockRejectedValue(new Error('fail'));

      await circuitBreaker.execute(successOperation);
      
      try {
        await circuitBreaker.execute(failOperation);
      } catch (error) {
        // Expected failure
      }

      const metrics = circuitBreaker.getMetrics();
      expect(metrics.successes).toBe(1);
      expect(metrics.failures).toBe(1);
      expect(metrics.totalRequests).toBe(2);
    });

    it('should calculate failure rate correctly', async () => {
      // Execute 2 successes and 3 failures
      const successOp = jest.fn().mockResolvedValue('success');
      const failOp = jest.fn().mockRejectedValue(new Error('fail'));

      await circuitBreaker.execute(successOp);
      await circuitBreaker.execute(successOp);

      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(failOp);
        } catch (error) {
          // Expected
        }
      }

      const failureRate = circuitBreaker.getFailureRate();
      expect(failureRate).toBe(0.6); // 3 failures out of 5 requests
    });

    it('should provide request history', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      await circuitBreaker.execute(operation);

      const history = circuitBreaker.getRequestHistory();
      expect(history.length).toBe(1);
      expect(history[0].success).toBe(true);
      expect(history[0].timestamp).toBeInstanceOf(Date);
    });

    it('should clean old requests from history', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      
      // Execute operation
      await circuitBreaker.execute(operation);
      
      // Advance time beyond monitoring window
      jest.useFakeTimers();
      jest.advanceTimersByTime(6000); // 6 seconds > 5 second window
      
      // Trigger history cleanup by getting metrics
      circuitBreaker.getMetrics();
      
      const history = circuitBreaker.getRequestHistory();
      expect(history.length).toBe(0);
      
      jest.useRealTimers();
    });
  });

  describe('Reset Functionality', () => {
    it('should reset circuit breaker to initial state', async () => {
      // Force to OPEN state
      circuitBreaker.forceState(CircuitBreakerState.OPEN);
      
      // Reset
      circuitBreaker.reset();
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failures).toBe(0);
      expect(metrics.successes).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should wrap CircuitBreakerOpenError with metrics', async () => {
      circuitBreaker.forceState(CircuitBreakerState.OPEN);
      
      const operation = jest.fn();
      
      try {
        await circuitBreaker.execute(operation);
      } catch (error) {
        expect(error).toBeInstanceOf(CircuitBreakerOpenError);
        expect((error as CircuitBreakerOpenError).circuitBreakerName).toBe('test-breaker');
        expect((error as CircuitBreakerOpenError).metrics).toBeDefined();
      }
    });
  });
});

describe('CircuitBreakerFactory', () => {
  describe('createForLLMProvider', () => {
    it('should create circuit breaker with LLM provider settings', () => {
      const circuitBreaker = CircuitBreakerFactory.createForLLMProvider('test-provider');
      
      expect(circuitBreaker).toBeInstanceOf(CircuitBreaker);
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('createAggressive', () => {
    it('should create circuit breaker with aggressive settings', () => {
      const circuitBreaker = CircuitBreakerFactory.createAggressive('test-provider');
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('createPermissive', () => {
    it('should create circuit breaker with permissive settings', () => {
      const circuitBreaker = CircuitBreakerFactory.createPermissive('test-provider');
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitBreakerState.CLOSED);
    });
  });
});

describe('CircuitBreakerManager', () => {
  let manager: CircuitBreakerManager;

  beforeEach(() => {
    manager = new CircuitBreakerManager();
  });

  describe('Circuit Breaker Management', () => {
    it('should create and manage circuit breakers', () => {
      const circuitBreaker = manager.getCircuitBreaker('test-provider');
      
      expect(circuitBreaker).toBeInstanceOf(CircuitBreaker);
      expect(manager.size()).toBe(1);
    });

    it('should return same circuit breaker for same provider', () => {
      const cb1 = manager.getCircuitBreaker('test-provider');
      const cb2 = manager.getCircuitBreaker('test-provider');
      
      expect(cb1).toBe(cb2);
    });

    it('should use custom factory when provided', () => {
      const customFactory = jest.fn(() => 
        CircuitBreakerFactory.createAggressive('custom')
      );
      
      manager.getCircuitBreaker('custom-provider', customFactory);
      
      expect(customFactory).toHaveBeenCalled();
    });

    it('should get metrics for all circuit breakers', () => {
      manager.getCircuitBreaker('provider1');
      manager.getCircuitBreaker('provider2');
      
      const allMetrics = manager.getAllMetrics();
      
      expect(allMetrics.size).toBe(2);
      expect(allMetrics.has('provider1')).toBe(true);
      expect(allMetrics.has('provider2')).toBe(true);
    });

    it('should reset all circuit breakers', () => {
      const cb1 = manager.getCircuitBreaker('provider1');
      const cb2 = manager.getCircuitBreaker('provider2');
      
      // Force states to OPEN
      cb1.forceState(CircuitBreakerState.OPEN);
      cb2.forceState(CircuitBreakerState.OPEN);
      
      manager.resetAll();
      
      expect(cb1.getState()).toBe(CircuitBreakerState.CLOSED);
      expect(cb2.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should remove circuit breaker', () => {
      manager.getCircuitBreaker('test-provider');
      expect(manager.size()).toBe(1);
      
      const removed = manager.removeCircuitBreaker('test-provider');
      expect(removed).toBe(true);
      expect(manager.size()).toBe(0);
    });

    it('should return false when removing non-existent circuit breaker', () => {
      const removed = manager.removeCircuitBreaker('non-existent');
      expect(removed).toBe(false);
    });
  });
});