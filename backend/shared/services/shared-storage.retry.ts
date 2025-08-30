import { sharedStorageLogger } from './shared-storage.logger';
import { sharedStorageMetrics } from './shared-storage.metrics';

/**
 * SharedStorageRetry provides intelligent retry mechanisms with exponential backoff,
 * circuit breaker patterns, and adaptive retry strategies for the shared storage service
 */
export class SharedStorageRetry {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private retryStats: Map<string, RetryStats> = new Map();
  private adaptiveConfigs: Map<string, AdaptiveRetryConfig> = new Map();
  private readonly defaultConfig: RetryConfig;

  constructor() {
    this.defaultConfig = {
      maxAttempts: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      backoffMultiplier: 2,
      jitter: true,
      timeout: 60000 // 1 minute total timeout
    };

    this.initializeRetrySystem();
  }

  /**
   * Initialize retry system
   */
  private initializeRetrySystem(): void {
    // Set up periodic circuit breaker reset
    setInterval(() => {
      this.resetCircuitBreakers();
    }, 60000); // Reset every minute

    // Set up periodic adaptive config updates
    setInterval(() => {
      this.updateAdaptiveConfigs();
    }, 300000); // Update every 5 minutes

    sharedStorageLogger.logInfo('Retry system initialized', {
      defaultMaxAttempts: this.defaultConfig.maxAttempts,
      defaultBaseDelay: this.defaultConfig.baseDelay,
      circuitBreakerResetInterval: 60000
    });
  }

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: RetryContext,
    customConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.defaultConfig, ...customConfig };
    const operationId = this.generateOperationId();
    const circuitKey = this.getCircuitKey(context);

    // Check circuit breaker
    const circuitBreaker = this.circuitBreakers.get(circuitKey);
    if (circuitBreaker?.state === 'open') {
      throw new Error(`Circuit breaker is open for ${circuitKey}`);
    }

    let lastError: Error;
    let attempt = 0;
    const startTime = Date.now();

    while (attempt < config.maxAttempts) {
      try {
        // Check timeout
        if (Date.now() - startTime > config.timeout) {
          throw new Error(`Retry timeout exceeded after ${config.timeout}ms`);
        }

        // Execute operation
        const result = await operation();

        // Record success
        this.recordRetrySuccess(operationId, context, attempt + 1, Date.now() - startTime);

        // Close circuit breaker if it was half-open
        if (circuitBreaker?.state === 'half-open') {
          circuitBreaker.state = 'closed';
          circuitBreaker.failureCount = 0;
        }

        return result;

      } catch (error) {
        lastError = error as Error;
        attempt++;

        // Record failure
        this.recordRetryFailure(operationId, context, attempt, lastError);

        // Update circuit breaker
        this.updateCircuitBreaker(circuitKey, lastError);

        // Check if we should retry
        if (attempt >= config.maxAttempts) {
          break;
        }

        // Calculate delay for next attempt
        const delay = this.calculateDelay(attempt, config);

        sharedStorageLogger.logInfo('Retrying operation after failure', {
          operationId,
          attempt,
          maxAttempts: config.maxAttempts,
          delay,
          error: lastError.message,
          context
        });

        // Wait before next attempt
        await this.delay(delay);
      }
    }

    // All attempts failed
    this.recordRetryExhaustion(operationId, context, config.maxAttempts, lastError);

    // Update circuit breaker to open if too many failures
    this.handleCircuitBreakerOpen(circuitKey);

    throw lastError;
  }

  /**
   * Execute operation with adaptive retry strategy
   */
  async executeWithAdaptiveRetry<T>(
    operation: () => Promise<T>,
    context: RetryContext,
    operationType: string
  ): Promise<T> {
    const adaptiveConfig = this.getAdaptiveConfig(operationType);

    // Use adaptive config if available, otherwise use default
    const config = adaptiveConfig ? adaptiveConfig.config : this.defaultConfig;

    return this.executeWithRetry(operation, context, config);
  }

  /**
   * Calculate delay with exponential backoff and jitter
   */
  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);

    // Apply maximum delay limit
    delay = Math.min(delay, config.maxDelay);

    // Add jitter to prevent thundering herd
    if (config.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5); // 50-100% of calculated delay
    }

    return Math.floor(delay);
  }

  /**
   * Get or create circuit breaker for operation
   */
  private getCircuitBreaker(key: string): CircuitBreaker {
    let breaker = this.circuitBreakers.get(key);

    if (!breaker) {
      breaker = {
        key,
        state: 'closed',
        failureCount: 0,
        lastFailureTime: 0,
        successCount: 0,
        nextAttemptTime: 0,
        failureThreshold: 5,
        timeout: 60000, // 1 minute
        successThreshold: 3
      };
      this.circuitBreakers.set(key, breaker);
    }

    return breaker;
  }

  /**
   * Update circuit breaker state based on operation result
   */
  private updateCircuitBreaker(key: string, error?: Error): void {
    const breaker = this.getCircuitBreaker(key);

    if (error) {
      breaker.failureCount++;
      breaker.lastFailureTime = Date.now();

      if (breaker.state === 'closed' && breaker.failureCount >= breaker.failureThreshold) {
        breaker.state = 'open';
        breaker.nextAttemptTime = Date.now() + breaker.timeout;

        sharedStorageLogger.logInfo('Circuit breaker opened', {
          key,
          failureCount: breaker.failureCount,
          threshold: breaker.failureThreshold
        });

        // Record circuit breaker open in metrics
        sharedStorageMetrics.recordCircuitBreakerOpen(key);
      }
    } else {
      breaker.successCount++;

      if (breaker.state === 'half-open' && breaker.successCount >= breaker.successThreshold) {
        breaker.state = 'closed';
        breaker.failureCount = 0;
        breaker.successCount = 0;

        sharedStorageLogger.logInfo('Circuit breaker closed', { key });
      }
    }
  }

  /**
   * Handle circuit breaker opening
   */
  private handleCircuitBreakerOpen(key: string): void {
    const breaker = this.getCircuitBreaker(key);

    if (breaker.failureCount >= breaker.failureThreshold) {
      breaker.state = 'open';
      sharedStorageLogger.logInfo('Circuit breaker opened due to repeated failures', {
        key,
        failureCount: breaker.failureCount
      });
    }
  }

  /**
   * Reset circuit breakers periodically
   */
  private resetCircuitBreakers(): void {
    const now = Date.now();

    for (const [key, breaker] of this.circuitBreakers.entries()) {
      if (breaker.state === 'open' && now >= breaker.nextAttemptTime) {
        breaker.state = 'half-open';
        breaker.successCount = 0;

        sharedStorageLogger.logInfo('Circuit breaker moved to half-open', { key });
      }
    }
  }

  /**
   * Get adaptive retry configuration for operation type
   */
  private getAdaptiveConfig(operationType: string): AdaptiveRetryConfig | undefined {
    return this.adaptiveConfigs.get(operationType);
  }

  /**
   * Update adaptive retry configurations based on performance data
   */
  private updateAdaptiveConfigs(): void {
    // Analyze retry statistics to optimize configurations
    for (const [operationType, stats] of this.retryStats.entries()) {
      if (stats.totalRetries > 10) { // Need sufficient data
        const successRate = stats.successfulRetries / stats.totalRetries;

        let adaptiveConfig = this.adaptiveConfigs.get(operationType);
        if (!adaptiveConfig) {
          adaptiveConfig = {
            operationType,
            config: { ...this.defaultConfig },
            lastUpdated: new Date(),
            performanceHistory: []
          };
          this.adaptiveConfigs.set(operationType, adaptiveConfig);
        }

        // Adjust configuration based on success rate
        if (successRate > 0.8) {
          // High success rate - can be more aggressive
          adaptiveConfig.config.maxAttempts = Math.min(adaptiveConfig.config.maxAttempts + 1, 5);
          adaptiveConfig.config.baseDelay = Math.max(adaptiveConfig.config.baseDelay * 0.9, 500);
        } else if (successRate < 0.3) {
          // Low success rate - be more conservative
          adaptiveConfig.config.maxAttempts = Math.max(adaptiveConfig.config.maxAttempts - 1, 1);
          adaptiveConfig.config.baseDelay = Math.min(adaptiveConfig.config.baseDelay * 1.2, 10000);
        }

        adaptiveConfig.lastUpdated = new Date();
        adaptiveConfig.performanceHistory.push({
          timestamp: new Date(),
          successRate,
          avgAttempts: stats.avgAttemptsToSuccess
        });

        // Keep only recent history
        if (adaptiveConfig.performanceHistory.length > 20) {
          adaptiveConfig.performanceHistory.shift();
        }
      }
    }
  }

  /**
   * Record successful retry operation
   */
  private recordRetrySuccess(
    operationId: string,
    context: RetryContext,
    attempts: number,
    totalTime: number
  ): void {
    const stats = this.getRetryStats(context.operation);
    stats.successfulRetries++;
    stats.totalRetries++;
    stats.avgAttemptsToSuccess = ((stats.avgAttemptsToSuccess * (stats.successfulRetries - 1)) + attempts) / stats.successfulRetries;
    stats.lastSuccessTime = new Date();

    sharedStorageMetrics.recordRetrySuccess(context.operation, attempts, totalTime);

    sharedStorageLogger.logInfo('Retry operation succeeded', {
      operationId,
      operation: context.operation,
      attempts,
      totalTime,
      context
    });
  }

  /**
   * Record failed retry attempt
   */
  private recordRetryFailure(
    operationId: string,
    context: RetryContext,
    attempt: number,
    error: Error
  ): void {
    const stats = this.getRetryStats(context.operation);
    stats.failedRetries++;
    stats.totalRetries++;

    sharedStorageMetrics.recordRetryFailure(context.operation, attempt);

    sharedStorageLogger.logInfo('Retry attempt failed', {
      operationId,
      operation: context.operation,
      attempt,
      error: error.message,
      context
    });
  }

  /**
   * Record retry exhaustion (all attempts failed)
   */
  private recordRetryExhaustion(
    operationId: string,
    context: RetryContext,
    maxAttempts: number,
    lastError: Error
  ): void {
    const stats = this.getRetryStats(context.operation);
    stats.exhaustedRetries++;

    sharedStorageMetrics.recordRetryExhaustion(context.operation, maxAttempts);

    sharedStorageLogger.logInfo('Retry exhausted - all attempts failed', {
      operationId,
      operation: context.operation,
      maxAttempts,
      lastError: lastError.message,
      context
    });
  }

  /**
   * Get retry statistics for operation type
   */
  private getRetryStats(operation: string): RetryStats {
    let stats = this.retryStats.get(operation);

    if (!stats) {
      stats = {
        operation,
        totalRetries: 0,
        successfulRetries: 0,
        failedRetries: 0,
        exhaustedRetries: 0,
        avgAttemptsToSuccess: 0,
        lastSuccessTime: undefined,
        lastFailureTime: undefined
      };
      this.retryStats.set(operation, stats);
    }

    return stats;
  }

  /**
   * Get circuit breaker key for operation context
   */
  private getCircuitKey(context: RetryContext): string {
    return `${context.service}_${context.operation}`;
  }

  /**
   * Generate unique operation ID
   */
  private generateOperationId(): string {
    return `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get retry statistics
   */
  getRetryStats(operation?: string): RetryStats | Record<string, RetryStats> {
    if (operation) {
      return this.getRetryStats(operation);
    }

    return Object.fromEntries(this.retryStats);
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): Record<string, CircuitBreakerStatus> {
    const status: Record<string, CircuitBreakerStatus> = {};

    for (const [key, breaker] of this.circuitBreakers.entries()) {
      status[key] = {
        state: breaker.state,
        failureCount: breaker.failureCount,
        successCount: breaker.successCount,
        lastFailureTime: breaker.lastFailureTime,
        nextAttemptTime: breaker.nextAttemptTime
      };
    }

    return status;
  }

  /**
   * Get adaptive configuration status
   */
  getAdaptiveConfigs(): Record<string, AdaptiveRetryConfig> {
    return Object.fromEntries(this.adaptiveConfigs);
  }

  /**
   * Reset circuit breaker manually
   */
  resetCircuitBreaker(key: string): boolean {
    const breaker = this.circuitBreakers.get(key);
    if (breaker) {
      breaker.state = 'closed';
      breaker.failureCount = 0;
      breaker.successCount = 0;
      sharedStorageLogger.logInfo('Circuit breaker manually reset', { key });
      return true;
    }
    return false;
  }

  /**
   * Configure custom retry settings for operation type
   */
  configureRetry(operationType: string, config: Partial<RetryConfig>): void {
    const adaptiveConfig = this.adaptiveConfigs.get(operationType) || {
      operationType,
      config: { ...this.defaultConfig },
      lastUpdated: new Date(),
      performanceHistory: []
    };

    adaptiveConfig.config = { ...adaptiveConfig.config, ...config };
    adaptiveConfig.lastUpdated = new Date();

    this.adaptiveConfigs.set(operationType, adaptiveConfig);

    sharedStorageLogger.logInfo('Retry configuration updated', {
      operationType,
      config: adaptiveConfig.config
    });
  }
}

/**
 * Retry context interface
 */
export interface RetryContext {
  service: string;
  operation: string;
  sessionId?: string;
  filepath?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * Retry configuration interface
 */
export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  timeout: number;
}

/**
 * Circuit breaker interface
 */
export interface CircuitBreaker {
  key: string;
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: number;
  successCount: number;
  nextAttemptTime: number;
  failureThreshold: number;
  timeout: number;
  successThreshold: number;
}

/**
 * Circuit breaker status interface
 */
export interface CircuitBreakerStatus {
  state: string;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

/**
 * Retry statistics interface
 */
export interface RetryStats {
  operation: string;
  totalRetries: number;
  successfulRetries: number;
  failedRetries: number;
  exhaustedRetries: number;
  avgAttemptsToSuccess: number;
  lastSuccessTime?: Date;
  lastFailureTime?: Date;
}

/**
 * Adaptive retry configuration interface
 */
export interface AdaptiveRetryConfig {
  operationType: string;
  config: RetryConfig;
  lastUpdated: Date;
  performanceHistory: Array<{
    timestamp: Date;
    successRate: number;
    avgAttempts: number;
  }>;
}

// Export factory function
export const createSharedStorageRetry = () => {
  return new SharedStorageRetry();
};
