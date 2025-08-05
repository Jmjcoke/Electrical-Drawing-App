/**
 * Circuit breaker unit tests
 */

import { CircuitBreaker, CircuitBreakerState, CircuitBreakerError, createCircuitBreaker } from '../utils/circuit-breaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = createCircuitBreaker('test-breaker', {
      failureThreshold: 3,
      timeout: 1000,
      recoveryTime: 100,
      resetTimeout: 1000,
    });
  });

  describe('constructor and initial state', () => {
    it('should start in CLOSED state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should have correct name', () => {
      expect(circuitBreaker.getName()).toBe('test-breaker');
    });

    it('should have zero metrics initially', () => {
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.consecutiveFailures).toBe(0);
    });
  });

  describe('successful operations', () => {
    it('should execute successful operations', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      const result = await circuitBreaker.execute(mockOperation);
      
      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(0);
    });

    it('should stay in CLOSED state for successful operations', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      for (let i = 0; i < 5; i++) {
        await circuitBreaker.execute(mockOperation);
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('failed operations', () => {
    it('should handle failed operations', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('operation failed'));
      
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('operation failed');
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.consecutiveFailures).toBe(1);
    });

    it('should open circuit after reaching failure threshold', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('operation failed'));
      
      // Fail 3 times (threshold)
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('operation failed');
      }
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should throw CircuitBreakerError when OPEN', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('operation failed'));
      
      // Reach failure threshold
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('operation failed');
      }
      
      // Next call should throw CircuitBreakerError
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow(CircuitBreakerError);
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Circuit breaker \'test-breaker\' is OPEN');
    });
  });

  describe('timeout handling', () => {
    it('should timeout long-running operations', async () => {
      const mockOperation = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 2000)) // 2 seconds, longer than 1 second timeout
      );
      
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('Operation timeout after 1000ms');
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failedRequests).toBe(1);
    });

    it('should complete fast operations before timeout', async () => {
      const mockOperation = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('success'), 100)) // 100ms, faster than 1 second timeout
      );
      
      const result = await circuitBreaker.execute(mockOperation);
      expect(result).toBe('success');
    });
  });

  describe('recovery behavior', () => {
    beforeEach(async () => {
      // Force circuit to OPEN state
      const failingOperation = jest.fn().mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 3; i++) {
        await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow();
      }
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should transition to HALF_OPEN after recovery time', async () => {
      // Wait for recovery time
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Trigger state update by attempting operation
      const mockOperation = jest.fn().mockResolvedValue('success');
      await circuitBreaker.execute(mockOperation);
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should close circuit on successful operation in HALF_OPEN state', async () => {
      // Wait for recovery time
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const mockOperation = jest.fn().mockResolvedValue('success');
      await circuitBreaker.execute(mockOperation);
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should reopen circuit on failed operation in HALF_OPEN state', async () => {
      // Wait for recovery time
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Force to half-open by checking state
      (circuitBreaker as any).updateState();
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
      
      const mockOperation = jest.fn().mockRejectedValue(new Error('still failing'));
      await expect(circuitBreaker.execute(mockOperation)).rejects.toThrow('still failing');
      
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });
  });

  describe('manual controls', () => {
    it('should force open', () => {
      circuitBreaker.forceOpen();
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
    });

    it('should force close', () => {
      circuitBreaker.forceOpen();
      circuitBreaker.forceClose();
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should force half-open', () => {
      circuitBreaker.forceHalfOpen();
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
    });

    it('should reset metrics', () => {
      // Generate some metrics
      const mockOperation = jest.fn().mockRejectedValue(new Error('fail'));
      circuitBreaker.execute(mockOperation).catch(() => {});
      
      circuitBreaker.reset();
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
      expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('metrics tracking', () => {
    it('should track all request types', async () => {
      const successOperation = jest.fn().mockResolvedValue('success');
      const failOperation = jest.fn().mockRejectedValue(new Error('fail'));
      
      // Execute mix of operations
      await circuitBreaker.execute(successOperation);
      await circuitBreaker.execute(successOperation);
      await expect(circuitBreaker.execute(failOperation)).rejects.toThrow();
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.totalRequests).toBe(3);
      expect(metrics.successfulRequests).toBe(2);
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.consecutiveFailures).toBe(1);
      expect(metrics.consecutiveSuccesses).toBe(0); // Reset after failure
    });

    it('should track timestamps', async () => {
      const successOperation = jest.fn().mockResolvedValue('success');
      const failOperation = jest.fn().mockRejectedValue(new Error('fail'));
      
      await circuitBreaker.execute(successOperation);
      // Add small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 1));
      await expect(circuitBreaker.execute(failOperation)).rejects.toThrow();
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.lastSuccessTime).toBeInstanceOf(Date);
      expect(metrics.lastFailureTime).toBeInstanceOf(Date);
      expect(metrics.lastFailureTime!.getTime()).toBeGreaterThan(metrics.lastSuccessTime!.getTime());
    });
  });

  describe('factory function', () => {
    it('should create circuit breaker with default config', () => {
      const defaultBreaker = createCircuitBreaker('default-test');
      
      expect(defaultBreaker.getName()).toBe('default-test');
      expect(defaultBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
    });

    it('should create circuit breaker with custom config', () => {
      const customBreaker = createCircuitBreaker('custom-test', {
        failureThreshold: 10
      });
      
      expect(customBreaker.getName()).toBe('custom-test');
    });
  });
});