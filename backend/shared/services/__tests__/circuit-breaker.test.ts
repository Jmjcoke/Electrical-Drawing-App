import { CircuitBreakerService, CircuitBreakerConfig } from '../circuit-breaker.service';

describe('CircuitBreakerService', () => {
  let circuitBreaker: CircuitBreakerService;
  let config: CircuitBreakerConfig;

  beforeEach(() => {
    config = {
      failureThreshold: 3,
      recoveryTimeout: 1000, // 1 second for testing
      monitoringPeriod: 500,
      successThreshold: 2,
      timeout: 500,
      healthCheckInterval: 100,
    };
    circuitBreaker = new CircuitBreakerService(config);
  });

  afterEach(() => {
    circuitBreaker.cleanup();
  });

  describe('Basic Functionality', () => {
    it('should create circuit breaker and execute successful operation', async () => {
      const operationKey = 'test-operation';
      let executionCount = 0;

      const result = await circuitBreaker.executeWithCircuitBreaker(
        operationKey,
        async () => {
          executionCount++;
          return 'success';
        }
      );

      expect(result).toBe('success');
      expect(executionCount).toBe(1);

      const status = circuitBreaker.getBreakerStatus(operationKey);
      expect(status?.state).toBe('CLOSED');
      expect(status?.successCount).toBe(1);
      expect(status?.failureCount).toBe(0);
    });

    it('should handle operation failure and track failure count', async () => {
      const operationKey = 'test-operation';
      let executionCount = 0;

      await expect(
        circuitBreaker.executeWithCircuitBreaker(
          operationKey,
          async () => {
            executionCount++;
            throw new Error('Test error');
          }
        )
      ).rejects.toThrow('Test error');

      expect(executionCount).toBe(1);

      const status = circuitBreaker.getBreakerStatus(operationKey);
      expect(status?.state).toBe('CLOSED');
      expect(status?.failureCount).toBe(1);
      expect(status?.successCount).toBe(0);
    });

    it('should open circuit after reaching failure threshold', async () => {
      const operationKey = 'test-operation';
      let executionCount = 0;

      // Fail the first 3 attempts
      for (let i = 0; i < 3; i++) {
        await expect(
          circuitBreaker.executeWithCircuitBreaker(
            operationKey,
            async () => {
              executionCount++;
              throw new Error(`Test error ${i + 1}`);
            }
          )
        ).rejects.toThrow();
      }

      expect(executionCount).toBe(3);

      const status = circuitBreaker.getBreakerStatus(operationKey);
      expect(status?.state).toBe('OPEN');
      expect(status?.failureCount).toBe(3);

      // Next attempt should fail immediately without executing
      await expect(
        circuitBreaker.executeWithCircuitBreaker(
          operationKey,
          async () => {
            executionCount++;
            return 'should not execute';
          }
        )
      ).rejects.toThrow('Circuit breaker is OPEN');

      expect(executionCount).toBe(3); // Should not have increased
    });

    it('should transition from half-open to closed on success', async () => {
      const operationKey = 'test-operation';

      // Force circuit open
      circuitBreaker.forceOpen(operationKey);

      let status = circuitBreaker.getBreakerStatus(operationKey);
      expect(status?.state).toBe('OPEN');

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Next attempt should succeed and close the circuit
      const result = await circuitBreaker.executeWithCircuitBreaker(
        operationKey,
        async () => 'recovery-success'
      );

      expect(result).toBe('recovery-success');

      status = circuitBreaker.getBreakerStatus(operationKey);
      expect(status?.state).toBe('CLOSED');
      expect(status?.successCount).toBe(1);
    });

    it('should stay open when half-open attempt fails', async () => {
      const operationKey = 'test-operation';

      // Force circuit open
      circuitBreaker.forceOpen(operationKey);

      // Wait for recovery timeout
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Half-open attempt fails
      await expect(
        circuitBreaker.executeWithCircuitBreaker(
          operationKey,
          async () => {
            throw new Error('Half-open failure');
          }
        )
      ).rejects.toThrow('Half-open failure');

      const status = circuitBreaker.getBreakerStatus(operationKey);
      expect(status?.state).toBe('OPEN');
    });
  });

  describe('Fallback Functionality', () => {
    it('should execute fallback when circuit is open', async () => {
      const operationKey = 'test-operation';
      let fallbackExecuted = false;

      // Force circuit open
      circuitBreaker.forceOpen(operationKey);

      const result = await circuitBreaker.executeWithCircuitBreaker(
        operationKey,
        async () => {
          throw new Error('Should not execute');
        },
        {
          fallback: async () => {
            fallbackExecuted = true;
            return 'fallback-result';
          }
        }
      );

      expect(result).toBe('fallback-result');
      expect(fallbackExecuted).toBe(true);
    });

    it('should execute fallback when operation fails and circuit allows', async () => {
      const operationKey = 'test-operation';
      let fallbackExecuted = false;

      const result = await circuitBreaker.executeWithCircuitBreaker(
        operationKey,
        async () => {
          throw new Error('Primary operation failed');
        },
        {
          fallback: async () => {
            fallbackExecuted = true;
            return 'fallback-result';
          }
        }
      );

      expect(result).toBe('fallback-result');
      expect(fallbackExecuted).toBe(true);
    });
  });

  describe('Timeout Functionality', () => {
    it('should timeout slow operations', async () => {
      const operationKey = 'test-operation';

      await expect(
        circuitBreaker.executeWithCircuitBreaker(
          operationKey,
          async () => {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Longer than timeout
            return 'slow-result';
          },
          { timeout: 100 }
        )
      ).rejects.toThrow('Operation timeout after 100ms');
    });

    it('should respect custom timeout', async () => {
      const operationKey = 'test-operation';

      const result = await circuitBreaker.executeWithCircuitBreaker(
        operationKey,
        async () => {
          await new Promise(resolve => setTimeout(resolve, 200));
          return 'timed-result';
        },
        { timeout: 500 }
      );

      expect(result).toBe('timed-result');
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should provide circuit breaker status', () => {
      const operationKey = 'test-operation';

      const status = circuitBreaker.getBreakerStatus(operationKey);
      expect(status).toBeNull(); // Not created yet

      // Create breaker by executing operation
      circuitBreaker.executeWithCircuitBreaker(operationKey, async () => 'test');

      const statusAfter = circuitBreaker.getBreakerStatus(operationKey);
      expect(statusAfter?.state).toBe('CLOSED');
      expect(statusAfter?.operationKey).toBe(operationKey);
    });

    it('should provide all breaker statuses', () => {
      const statuses = circuitBreaker.getAllBreakerStatuses();
      expect(statuses).toEqual({});
    });

    it('should calculate health score correctly', async () => {
      const operationKey = 'test-operation';

      // Healthy breaker
      await circuitBreaker.executeWithCircuitBreaker(operationKey, async () => 'success');

      let metrics = circuitBreaker.getBreakerMetrics(operationKey);
      expect(metrics.healthScore).toBe(100);

      // Force open
      circuitBreaker.forceOpen(operationKey);

      metrics = circuitBreaker.getBreakerMetrics(operationKey);
      expect(metrics.healthScore).toBeGreaterThan(10);
      expect(metrics.healthScore).toBeLessThanOrEqual(50);
    });

    it('should provide aggregate metrics', () => {
      const metrics = circuitBreaker.getBreakerMetrics();
      expect(metrics.operationKey).toBe('ALL');
      expect(metrics.healthScore).toBeDefined();
    });
  });

  describe('Manual Operations', () => {
    it('should manually reset circuit breaker', async () => {
      const operationKey = 'test-operation';

      // Create and open breaker
      for (let i = 0; i < 3; i++) {
        await expect(
          circuitBreaker.executeWithCircuitBreaker(
            operationKey,
            async () => { throw new Error('Test'); }
          )
        ).rejects.toThrow();
      }

      let status = circuitBreaker.getBreakerStatus(operationKey);
      expect(status?.state).toBe('OPEN');

      // Reset manually
      const reset = circuitBreaker.resetBreaker(operationKey);
      expect(reset).toBe(true);

      status = circuitBreaker.getBreakerStatus(operationKey);
      expect(status?.state).toBe('CLOSED');
      expect(status?.failureCount).toBe(0);
    });

    it('should handle reset of non-existent breaker', () => {
      const reset = circuitBreaker.resetBreaker('non-existent');
      expect(reset).toBe(false);
    });

    it('should configure breaker settings', async () => {
      const operationKey = 'test-operation';

      // Create breaker
      await circuitBreaker.executeWithCircuitBreaker(operationKey, async () => 'test');

      // Configure settings
      circuitBreaker.configureBreaker(operationKey, {
        failureThreshold: 5,
        recoveryTimeout: 2000,
      });

      const status = circuitBreaker.getBreakerStatus(operationKey);
      expect(status?.failureThreshold).toBe(5);
      expect(status?.recoveryTimeout).toBe(2000);
    });
  });

  describe('Event Emissions', () => {
    it('should emit circuit state change events', async () => {
      const operationKey = 'test-operation';
      const events: string[] = [];

      circuitBreaker.on('circuitOpened', () => events.push('opened'));
      circuitBreaker.on('circuitClosed', () => events.push('closed'));
      circuitBreaker.on('circuitReset', () => events.push('reset'));

      // Create and open circuit
      for (let i = 0; i < 3; i++) {
        await expect(
          circuitBreaker.executeWithCircuitBreaker(
            operationKey,
            async () => { throw new Error('Test'); }
          )
        ).rejects.toThrow();
      }

      expect(events).toContain('opened');

      // Reset circuit
      circuitBreaker.resetBreaker(operationKey);
      expect(events).toContain('reset');
    });

    it('should emit operation events', async () => {
      const operationKey = 'test-operation';
      const events: string[] = [];

      circuitBreaker.on('operationSuccess', () => events.push('success'));
      circuitBreaker.on('operationFailure', () => events.push('failure'));

      // Successful operation
      await circuitBreaker.executeWithCircuitBreaker(operationKey, async () => 'success');
      expect(events).toContain('success');

      // Failed operation
      await expect(
        circuitBreaker.executeWithCircuitBreaker(
          operationKey,
          async () => { throw new Error('Test'); }
        )
      ).rejects.toThrow();

      expect(events).toContain('failure');
    });
  });

  describe('Error Handling', () => {
    it('should handle operation errors gracefully', async () => {
      const operationKey = 'test-operation';

      await expect(
        circuitBreaker.executeWithCircuitBreaker(
          operationKey,
          async () => {
            throw new Error('Custom error message');
          }
        )
      ).rejects.toThrow('Custom error message');

      const status = circuitBreaker.getBreakerStatus(operationKey);
      expect(status?.failureCount).toBe(1);
    });

    it('should handle timeout errors', async () => {
      const operationKey = 'test-operation';

      await expect(
        circuitBreaker.executeWithCircuitBreaker(
          operationKey,
          async () => {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return 'timeout';
          },
          { timeout: 100 }
        )
      ).rejects.toThrow('Operation timeout');

      const status = circuitBreaker.getBreakerStatus(operationKey);
      expect(status?.failureCount).toBe(1);
    });
  });
});
