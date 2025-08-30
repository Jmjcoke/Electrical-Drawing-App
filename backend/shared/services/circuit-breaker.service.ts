import { EventEmitter } from 'events';
import { sharedStorageLogger } from './shared-storage.logger';
import { sharedStorageMetrics } from './shared-storage.metrics';

/**
 * Enhanced Circuit Breaker Service for SharedStorageService
 * Implements advanced circuit breaker patterns with health monitoring integration
 */
export class CircuitBreakerService extends EventEmitter {
  private readonly circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private readonly healthCheckInterval: NodeJS.Timeout;
  private readonly recoveryInterval: NodeJS.Timeout;

  constructor(
    private readonly config: CircuitBreakerConfig = {
      failureThreshold: 5,
      recoveryTimeout: 30000, // 30 seconds
      monitoringPeriod: 60000, // 1 minute
      successThreshold: 3,
      timeout: 5000, // 5 second timeout for operations
      healthCheckInterval: 10000, // 10 seconds
    }
  ) {
    super();

    // Set up periodic health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, config.healthCheckInterval);

    // Set up periodic recovery attempts
    this.recoveryInterval = setInterval(() => {
      this.attemptRecoveries();
    }, config.monitoringPeriod);

    sharedStorageLogger.logInfo('Circuit Breaker Service initialized', {
      failureThreshold: config.failureThreshold,
      recoveryTimeout: config.recoveryTimeout,
      successThreshold: config.successThreshold,
    });
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async executeWithCircuitBreaker<T>(
    operationKey: string,
    operation: () => Promise<T>,
    options?: {
      timeout?: number;
      fallback?: () => Promise<T>;
      context?: Record<string, any>;
    }
  ): Promise<T> {
    const breaker = this.getOrCreateBreaker(operationKey);
    const startTime = Date.now();

    try {
      // Check circuit breaker state
      if (breaker.state === 'OPEN') {
        const timeSinceOpen = Date.now() - breaker.lastFailureTime;

        if (timeSinceOpen < this.config.recoveryTimeout) {
          // Circuit is still open, reject immediately
          this.emit('circuitOpen', { operationKey, breaker: { ...breaker } });

          if (options?.fallback) {
            sharedStorageLogger.logInfo('Circuit breaker open, attempting fallback', { operationKey });
            return await options.fallback();
          }

          throw new Error(`Circuit breaker is OPEN for ${operationKey}`);
        } else {
          // Recovery timeout elapsed, try half-open
          breaker.state = 'HALF_OPEN';
          breaker.successCount = 0;
          sharedStorageLogger.logInfo('Circuit breaker moving to HALF_OPEN', { operationKey });
        }
      }

      // Execute operation with timeout
      const timeout = options?.timeout || this.config.timeout;
      const result = await this.executeWithTimeout(operation, timeout);

      // Record success
      this.recordSuccess(operationKey, Date.now() - startTime);
      this.emit('operationSuccess', {
        operationKey,
        duration: Date.now() - startTime,
        context: options?.context
      });

      return result;

    } catch (error) {
      // Record failure
      this.recordFailure(operationKey, error, Date.now() - startTime);

      this.emit('operationFailure', {
        operationKey,
        error: error.message,
        duration: Date.now() - startTime,
        context: options?.context
      });

      // Try fallback if provided
      if (options?.fallback && breaker.state !== 'OPEN') {
        try {
          sharedStorageLogger.logInfo('Operation failed, attempting fallback', { operationKey });
          return await options.fallback();
        } catch (fallbackError) {
          sharedStorageLogger.logError('Fallback also failed', fallbackError as Error, undefined, undefined, undefined, operationKey);
        }
      }

      throw error;
    }
  }

  /**
   * Get circuit breaker status
   */
  getBreakerStatus(operationKey: string): CircuitBreakerState | null {
    return this.circuitBreakers.get(operationKey) || null;
  }

  /**
   * Get all circuit breaker statuses
   */
  getAllBreakerStatuses(): Record<string, CircuitBreakerState> {
    const statuses: Record<string, CircuitBreakerState> = {};

    for (const [key, breaker] of this.circuitBreakers.entries()) {
      statuses[key] = { ...breaker };
    }

    return statuses;
  }

  /**
   * Manually reset circuit breaker
   */
  resetBreaker(operationKey: string): boolean {
    const breaker = this.circuitBreakers.get(operationKey);

    if (breaker) {
      breaker.state = 'CLOSED';
      breaker.failureCount = 0;
      breaker.successCount = 0;
      breaker.lastFailureTime = 0;
      breaker.nextAttemptTime = 0;

      this.emit('circuitReset', { operationKey, breaker: { ...breaker } });
      sharedStorageLogger.logInfo('Circuit breaker manually reset', { operationKey });

      return true;
    }

    return false;
  }

  /**
   * Force circuit breaker open (for testing)
   */
  forceOpen(operationKey: string): boolean {
    const breaker = this.getOrCreateBreaker(operationKey);

    breaker.state = 'OPEN';
    breaker.lastFailureTime = Date.now();
    breaker.nextAttemptTime = Date.now() + this.config.recoveryTimeout;

    this.emit('circuitForcedOpen', { operationKey });
    sharedStorageLogger.logInfo('Circuit breaker forced open', { operationKey });

    return true;
  }

  /**
   * Configure circuit breaker settings
   */
  configureBreaker(operationKey: string, config: Partial<CircuitBreakerConfig>): void {
    const breaker = this.getOrCreateBreaker(operationKey);

    // Update breaker-specific config
    if (config.failureThreshold !== undefined) {
      breaker.failureThreshold = config.failureThreshold;
    }
    if (config.recoveryTimeout !== undefined) {
      breaker.recoveryTimeout = config.recoveryTimeout;
    }
    if (config.successThreshold !== undefined) {
      breaker.successThreshold = config.successThreshold;
    }

    sharedStorageLogger.logInfo('Circuit breaker configured', {
      operationKey,
      config: { ...config }
    });
  }

  /**
   * Get circuit breaker metrics
   */
  getBreakerMetrics(operationKey?: string): CircuitBreakerMetrics {
    if (operationKey) {
      const breaker = this.circuitBreakers.get(operationKey);
      if (!breaker) {
        throw new Error(`Circuit breaker not found: ${operationKey}`);
      }

      return {
        operationKey,
        state: breaker.state,
        failureCount: breaker.failureCount,
        successCount: breaker.successCount,
        totalRequests: breaker.failureCount + breaker.successCount,
        failureRate: breaker.failureCount + breaker.successCount > 0
          ? (breaker.failureCount / (breaker.failureCount + breaker.successCount)) * 100
          : 0,
        lastFailureTime: breaker.lastFailureTime,
        nextAttemptTime: breaker.nextAttemptTime,
        uptime: Date.now() - breaker.createdAt,
        healthScore: this.calculateHealthScore(breaker)
      };
    }

    // Aggregate metrics for all breakers
    const allBreakers = Array.from(this.circuitBreakers.values());
    const totalRequests = allBreakers.reduce((sum, b) => sum + b.failureCount + b.successCount, 0);
    const totalFailures = allBreakers.reduce((sum, b) => sum + b.failureCount, 0);
    const openBreakers = allBreakers.filter(b => b.state === 'OPEN').length;
    const halfOpenBreakers = allBreakers.filter(b => b.state === 'HALF_OPEN').length;

    return {
      operationKey: 'ALL',
      state: 'AGGREGATE',
      failureCount: totalFailures,
      successCount: totalRequests - totalFailures,
      totalRequests,
      failureRate: totalRequests > 0 ? (totalFailures / totalRequests) * 100 : 0,
      openBreakers,
      halfOpenBreakers,
      totalBreakers: allBreakers.length,
      healthScore: this.calculateAggregateHealthScore(allBreakers)
    };
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
    }

    this.circuitBreakers.clear();
    sharedStorageLogger.logInfo('Circuit Breaker Service cleaned up');
  }

  /**
   * Get or create circuit breaker for operation
   */
  private getOrCreateBreaker(operationKey: string): CircuitBreakerState {
    let breaker = this.circuitBreakers.get(operationKey);

    if (!breaker) {
      breaker = {
        operationKey,
        state: 'CLOSED',
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
        successCount: 0,
        createdAt: Date.now(),
        failureThreshold: this.config.failureThreshold,
        recoveryTimeout: this.config.recoveryTimeout,
        successThreshold: this.config.successThreshold,
      };

      this.circuitBreakers.set(operationKey, breaker);

      this.emit('circuitCreated', { operationKey, breaker: { ...breaker } });
      sharedStorageLogger.logInfo('Circuit breaker created', { operationKey });
    }

    return breaker;
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Operation timeout after ${timeout}ms`));
      }, timeout);

      operation()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Record successful operation
   */
  private recordSuccess(operationKey: string, duration: number): void {
    const breaker = this.getOrCreateBreaker(operationKey);

    breaker.successCount++;

    // Handle half-open state recovery - single success closes circuit
    if (breaker.state === 'HALF_OPEN') {
      breaker.state = 'CLOSED';
      breaker.failureCount = 0;
      // Keep successCount as-is (should be 1) for status reporting

      this.emit('circuitClosed', { operationKey, breaker: { ...breaker } });
      sharedStorageLogger.logInfo('Circuit breaker recovered and closed', { operationKey });
    }

    // Record metrics using existing methods
    sharedStorageMetrics.recordAccessMetrics('circuit_breaker_success', 'circuit-breaker', duration, true);
  }

  /**
   * Record failed operation
   */
  private recordFailure(operationKey: string, error: Error, duration: number): void {
    const breaker = this.getOrCreateBreaker(operationKey);

    breaker.failureCount++;
    breaker.lastFailureTime = Date.now();

    // Check if circuit should open
    if (breaker.state === 'CLOSED' && breaker.failureCount >= breaker.failureThreshold) {
      breaker.state = 'OPEN';
      breaker.nextAttemptTime = Date.now() + breaker.recoveryTimeout;

      this.emit('circuitOpened', {
        operationKey,
        breaker: { ...breaker },
        lastError: error.message
      });

      sharedStorageLogger.logWarn('Circuit breaker opened due to failures', {
        operationKey,
        failureCount: breaker.failureCount,
        threshold: breaker.failureThreshold,
        lastError: error.message
      });
    } else if (breaker.state === 'HALF_OPEN') {
      // Half-open attempt failed, go back to open
      breaker.state = 'OPEN';
      breaker.nextAttemptTime = Date.now() + breaker.recoveryTimeout;

      this.emit('circuitHalfOpenFailed', {
        operationKey,
        breaker: { ...breaker },
        error: error.message
      });

      sharedStorageLogger.logInfo('Circuit breaker half-open attempt failed', {
        operationKey,
        lastError: error.message,
        event: 'circuit_breaker_half_open_failed'
      });
    }

    // Record metrics using existing methods
    sharedStorageMetrics.recordAccessMetrics('circuit_breaker_failure', 'circuit-breaker', duration, false, 'circuit_breaker_failure');
  }

  /**
   * Perform periodic health checks
   */
  private performHealthChecks(): void {
    const now = Date.now();

    for (const [operationKey, breaker] of this.circuitBreakers.entries()) {
      // Check for stale half-open breakers
      if (breaker.state === 'HALF_OPEN' && now - breaker.lastFailureTime > breaker.recoveryTimeout) {
        breaker.state = 'OPEN';
        breaker.nextAttemptTime = now + breaker.recoveryTimeout;

        this.emit('circuitHalfOpenExpired', { operationKey, breaker: { ...breaker } });
        sharedStorageLogger.logInfo('Circuit breaker half-open state expired', { operationKey, event: 'circuit_breaker_half_open_expired' });
      }

      // Emit health status
      const healthScore = this.calculateHealthScore(breaker);
      this.emit('healthCheck', {
        operationKey,
        healthScore,
        breaker: { ...breaker }
      });
    }
  }

  /**
   * Attempt recovery for open circuits
   */
  private attemptRecoveries(): void {
    const now = Date.now();

    for (const [operationKey, breaker] of this.circuitBreakers.entries()) {
      if (breaker.state === 'OPEN' && now >= breaker.nextAttemptTime) {
        // Try to recover
        breaker.state = 'HALF_OPEN';
        breaker.successCount = 0;

        this.emit('circuitRecoveryAttempt', { operationKey, breaker: { ...breaker } });
        sharedStorageLogger.logInfo('Circuit breaker attempting recovery', { operationKey });
      }
    }
  }

  /**
   * Calculate health score for a circuit breaker
   */
  private calculateHealthScore(breaker: CircuitBreakerState): number {
    if (breaker.state === 'CLOSED') {
      return 100;
    }

    if (breaker.state === 'HALF_OPEN') {
      return 50;
    }

    // OPEN state - calculate based on time since failure
    const timeSinceFailure = Date.now() - breaker.lastFailureTime;
    const recoveryProgress = Math.min(timeSinceFailure / breaker.recoveryTimeout, 1);

    // Ensure minimum health score is slightly above 10 for OPEN state
    return Math.max(15, recoveryProgress * 40); // 15-50 for OPEN state
  }

  /**
   * Calculate aggregate health score
   */
  private calculateAggregateHealthScore(breakers: CircuitBreakerState[]): number {
    if (breakers.length === 0) {
      return 100;
    }

    const totalScore = breakers.reduce((sum, breaker) => sum + this.calculateHealthScore(breaker), 0);
    return Math.round(totalScore / breakers.length);
  }
}

/**
 * Circuit Breaker Configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  successThreshold: number;
  timeout: number;
  healthCheckInterval: number;
}

/**
 * Circuit Breaker State
 */
export interface CircuitBreakerState {
  operationKey: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
  successCount: number;
  createdAt: number;
  failureThreshold: number;
  recoveryTimeout: number;
  successThreshold: number;
}

/**
 * Circuit Breaker Metrics
 */
export interface CircuitBreakerMetrics {
  operationKey: string;
  state: string;
  failureCount: number;
  successCount: number;
  totalRequests?: number;
  failureRate?: number;
  lastFailureTime?: number;
  nextAttemptTime?: number;
  uptime?: number;
  healthScore?: number;
  openBreakers?: number;
  halfOpenBreakers?: number;
  totalBreakers?: number;
}

// Export factory function
export const createCircuitBreakerService = (config?: CircuitBreakerConfig) => {
  return new CircuitBreakerService(config);
};
