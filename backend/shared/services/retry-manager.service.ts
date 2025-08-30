import { EventEmitter } from 'events';
import { CircuitBreakerService } from './circuit-breaker.service';
import { sharedStorageLogger } from './shared-storage.logger';
import { sharedStorageMetrics } from './shared-storage.metrics';
import {
  RetryManagerConfig,
  RetryConfig,
  RetryOperationContext,
  RetryExecutionContext,
  RetryAttempt,
  RetryBudget,
  ErrorPattern,
  PredictiveRetryData,
  ErrorPatternStats,
  RetryManagerStatistics,
  defaultRetryManagerConfig
} from './retry-manager.types';

/**
 * Enhanced Intelligent Retry Manager
 * Provides advanced retry strategies with circuit breaker integration,
 * error classification, and predictive retry capabilities
 */
export class RetryManagerService extends EventEmitter {
  private readonly retryContexts: Map<string, RetryExecutionContext> = new Map();
  private readonly retryBudgets: Map<string, RetryBudget> = new Map();
  private readonly errorPatterns: Map<string, ErrorPattern> = new Map();
  private readonly predictiveRetryModel: Map<string, PredictiveRetryData> = new Map();

  constructor(
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly config: RetryManagerConfig = defaultRetryManagerConfig
  ) {
    super();
    this.initializeRetryManager();
  }

  /**
   * Initialize retry manager components
   */
  private initializeRetryManager(): void {
    // Set up periodic cleanup
    setInterval(() => {
      this.cleanupExpiredContexts();
      this.updatePredictiveModel();
    }, this.config.cleanupInterval);

    // Set up circuit breaker event listeners
    this.circuitBreaker.on('circuitOpened', this.handleCircuitBreakerOpen.bind(this));
    this.circuitBreaker.on('circuitClosed', this.handleCircuitBreakerClose.bind(this));
    this.circuitBreaker.on('circuitHalfOpen', this.handleCircuitBreakerHalfOpen.bind(this));

    sharedStorageLogger.logInfo('Retry Manager Service initialized', {
      cleanupInterval: this.config.cleanupInterval,
      maxConcurrentRetries: this.config.maxConcurrentRetries,
      defaultMaxAttempts: this.config.defaultRetryConfig.maxAttempts
    });
  }

  /**
   * Execute operation with intelligent retry logic
   */
  async executeWithIntelligentRetry<T>(
    operation: () => Promise<T>,
    context: RetryOperationContext
  ): Promise<T> {
    const operationId = this.generateOperationId();
    const executionContext: RetryExecutionContext = {
      operationId,
      operationContext: context,
      startTime: Date.now(),
      attempts: [],
      status: 'running',
      correlationId: context.correlationId || this.generateCorrelationId()
    };

    this.retryContexts.set(operationId, executionContext);

    try {
      // Check retry budget
      if (!this.checkRetryBudget(context.operationType)) {
        throw new Error(`Retry budget exceeded for operation type: ${context.operationType}`);
      }

      // Get circuit breaker key
      const circuitKey = this.getCircuitBreakerKey(context);
      const breakerStatus = this.circuitBreaker.getBreakerStatus(circuitKey);

      // Check circuit breaker state
      if (breakerStatus?.state === 'OPEN') {
        executionContext.status = 'circuit_open';
        this.recordRetryContext(executionContext);
        throw new Error(`Circuit breaker is OPEN for ${circuitKey}`);
      }

      const result = await this.executeWithRetryLoop(operation, executionContext, context);
      executionContext.status = 'success';
      this.recordRetryContext(executionContext);

      return result;

    } catch (error) {
      executionContext.status = 'failed';
      executionContext.finalError = error as Error;
      this.recordRetryContext(executionContext);

      // Update error patterns for predictive retries
      this.updateErrorPattern(context.operationType, error as Error);

      throw error;
    }
  }

  /**
   * Execute retry loop with intelligent decision making
   */
  private async executeWithRetryLoop<T>(
    operation: () => Promise<T>,
    executionContext: RetryExecutionContext,
    context: RetryOperationContext
  ): Promise<T> {
    const retryConfig = this.getRetryConfig(context);
    let lastError: Error | null = null;
    let attemptNumber = 0;

    while (attemptNumber < retryConfig.maxAttempts) {
      const attemptStartTime = Date.now();

      try {
        // Check timeout
        if (Date.now() - executionContext.startTime > retryConfig.totalTimeout) {
          throw new Error(`Retry timeout exceeded after ${retryConfig.totalTimeout}ms`);
        }

        // Execute with circuit breaker
        const circuitKey = this.getCircuitBreakerKey(context);
        const result = await this.circuitBreaker.executeWithCircuitBreaker(
          circuitKey,
          operation,
          {
            timeout: retryConfig.operationTimeout,
            fallback: context.fallback
          }
        );

        // Record successful attempt
        executionContext.attempts.push({
          attemptNumber: attemptNumber + 1,
          startTime: attemptStartTime,
          endTime: Date.now(),
          duration: Date.now() - attemptStartTime,
          success: true
        });

        return result;

      } catch (error) {
        lastError = error as Error;
        attemptNumber++;

        // Record failed attempt
        executionContext.attempts.push({
          attemptNumber,
          startTime: attemptStartTime,
          endTime: Date.now(),
          duration: Date.now() - attemptStartTime,
          success: false,
          error: lastError
        });

        // Check if we should retry
        if (attemptNumber >= retryConfig.maxAttempts) {
          break;
        }

        // Classify error to determine if retry is appropriate
        if (!this.shouldRetryError(lastError, context.operationType)) {
          break;
        }

        // Calculate intelligent delay
        const delay = this.calculateIntelligentDelay(
          attemptNumber,
          retryConfig,
          lastError,
          context.operationType
        );

        sharedStorageLogger.logInfo('Intelligent retry scheduled', {
          operationId: executionContext.operationId,
          attempt: attemptNumber,
          maxAttempts: retryConfig.maxAttempts,
          delay,
          error: lastError.message,
          operationType: context.operationType,
          correlationId: executionContext.correlationId
        });

        // Wait before next attempt
        await this.delay(delay);
      }
    }

    // All retries exhausted
    sharedStorageLogger.logError(
      'Intelligent retry exhausted',
      new Error(`All ${retryConfig.maxAttempts} retry attempts failed`),
      undefined,
      undefined,
      undefined,
      executionContext.correlationId
    );

    throw lastError || new Error('Retry exhausted without specific error');
  }

  /**
   * Calculate intelligent delay based on error type and operation characteristics
   */
  private calculateIntelligentDelay(
    attemptNumber: number,
    config: RetryConfig,
    error: Error,
    operationType: string
  ): number {
    let baseDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attemptNumber - 1);
    baseDelay = Math.min(baseDelay, config.maxDelay);

    // Adjust delay based on error type
    const errorMultiplier = this.getErrorTypeMultiplier(error);
    baseDelay *= errorMultiplier;

    // Apply jitter
    if (config.jitterEnabled) {
      const jitterRange = config.jitterRange || 0.1;
      const jitter = 1 + (Math.random() - 0.5) * jitterRange * 2;
      baseDelay *= jitter;
    }

    // Apply predictive adjustments based on historical data
    const predictiveAdjustment = this.getPredictiveAdjustment(operationType, error);
    baseDelay *= predictiveAdjustment;

    return Math.floor(Math.max(baseDelay, config.minDelay));
  }

  /**
   * Get multiplier based on error type for intelligent backoff
   */
  private getErrorTypeMultiplier(error: Error): number {
    const errorMessage = error.message.toLowerCase();

    // Network errors - longer backoff
    if (errorMessage.includes('timeout') || errorMessage.includes('connection')) {
      return 1.5;
    }

    // Rate limiting - exponential backoff
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return 2.0;
    }

    // Server errors - moderate backoff
    if (errorMessage.includes('500') || errorMessage.includes('503')) {
      return 1.2;
    }

    // Client errors - shorter backoff
    if (errorMessage.includes('400') || errorMessage.includes('404')) {
      return 0.8;
    }

    // Default multiplier
    return 1.0;
  }

  /**
   * Get predictive adjustment based on historical success patterns
   */
  private getPredictiveAdjustment(operationType: string, error: Error): number {
    const predictiveData = this.predictiveRetryModel.get(operationType);
    if (!predictiveData) {
      return 1.0;
    }

    const errorType = this.classifyError(error);
    const pattern = predictiveData.errorPatterns.get(errorType);

    if (!pattern || pattern.totalAttempts < 10) {
      return 1.0;
    }

    // If success rate is low for this error type, increase delay
    const successRate = pattern.successCount / pattern.totalAttempts;
    if (successRate < 0.3) {
      return 1.5;
    }

    // If success rate is high, slightly reduce delay
    if (successRate > 0.8) {
      return 0.9;
    }

    return 1.0;
  }

  /**
   * Classify error for pattern analysis
   */
  private classifyError(error: Error): string {
    const message = error.message.toLowerCase();

    if (message.includes('timeout')) return 'timeout';
    if (message.includes('connection')) return 'connection';
    if (message.includes('rate limit') || message.includes('429')) return 'rate_limit';
    if (message.includes('500') || message.includes('503')) return 'server_error';
    if (message.includes('400') || message.includes('404')) return 'client_error';
    if (message.includes('disk') || message.includes('storage')) return 'storage_error';

    return 'unknown';
  }

  /**
   * Determine if an error should be retried based on classification
   */
  private shouldRetryError(error: Error, operationType: string): boolean {
    const errorType = this.classifyError(error);

    // Always retry network and server errors
    if (['timeout', 'connection', 'server_error'].includes(errorType)) {
      return true;
    }

    // Sometimes retry rate limiting
    if (errorType === 'rate_limit') {
      return Math.random() < 0.7; // 70% chance to retry
    }

    // Never retry client errors
    if (['client_error'].includes(errorType)) {
      return false;
    }

    // Check predictive model
    const predictiveData = this.predictiveRetryModel.get(operationType);
    if (predictiveData) {
      const pattern = predictiveData.errorPatterns.get(errorType);
      if (pattern && pattern.totalAttempts > 5) {
        const successRate = pattern.successCount / pattern.totalAttempts;
        return successRate > 0.2; // Only retry if success rate > 20%
      }
    }

    // Default to retry for unknown errors
    return true;
  }

  /**
   * Check if retry budget allows this operation
   */
  private checkRetryBudget(operationType: string): boolean {
    const budget = this.retryBudgets.get(operationType) || this.createRetryBudget(operationType);

    if (budget.currentUsage >= budget.limit) {
      return false;
    }

    budget.currentUsage++;
    return true;
  }

  /**
   * Create retry budget for operation type
   */
  private createRetryBudget(operationType: string): RetryBudget {
    const budget: RetryBudget = {
      operationType,
      limit: this.config.defaultRetryBudget,
      currentUsage: 0,
      resetTime: Date.now() + this.config.budgetResetInterval,
      lastReset: Date.now()
    };

    this.retryBudgets.set(operationType, budget);
    return budget;
  }

  /**
   * Update error patterns for predictive analysis
   */
  private updateErrorPattern(operationType: string, error: Error): void {
    const errorType = this.classifyError(error);
    const key = `${operationType}:${errorType}`;

    let pattern = this.errorPatterns.get(key);
    if (!pattern) {
      pattern = {
        operationType,
        errorType,
        occurrences: 0,
        lastSeen: 0,
        avgTimeBetweenOccurrences: 0,
        previousOccurrence: 0
      };
      this.errorPatterns.set(key, pattern);
    }

    const now = Date.now();
    pattern.occurrences++;

    if (pattern.previousOccurrence > 0) {
      const timeDiff = now - pattern.previousOccurrence;
      pattern.avgTimeBetweenOccurrences =
        (pattern.avgTimeBetweenOccurrences * (pattern.occurrences - 1) + timeDiff) / pattern.occurrences;
    }

    pattern.lastSeen = now;
    pattern.previousOccurrence = now;
  }

  /**
   * Update predictive retry model
   */
  private updatePredictiveModel(): void {
    // Update predictive data based on recent patterns
    for (const [operationType, predictiveData] of this.predictiveRetryModel.entries()) {
      // Analyze recent retry contexts for this operation type
      const recentContexts = Array.from(this.retryContexts.values())
        .filter(ctx => ctx.operationContext.operationType === operationType)
        .filter(ctx => Date.now() - ctx.startTime < this.config.predictiveAnalysisWindow);

      // Update success rates and patterns
      this.updatePredictivePatterns(predictiveData, recentContexts);
    }
  }

  /**
   * Update predictive patterns from recent retry contexts
   */
  private updatePredictivePatterns(
    predictiveData: PredictiveRetryData,
    contexts: RetryExecutionContext[]
  ): void {
    for (const context of contexts) {
      if (context.finalError) {
        const errorType = this.classifyError(context.finalError);
        let pattern = predictiveData.errorPatterns.get(errorType);

        if (!pattern) {
          pattern = {
            errorType,
            totalAttempts: 0,
            successCount: 0,
            avgRetryTime: 0,
            lastSeen: Date.now()
          };
          predictiveData.errorPatterns.set(errorType, pattern);
        }

        pattern.totalAttempts++;
        if (context.attempts.some(a => a.success)) {
          pattern.successCount++;
        }

        // Update average retry time
        const totalRetryTime = context.attempts.reduce((sum, a) => sum + a.duration, 0);
        pattern.avgRetryTime = (pattern.avgRetryTime + totalRetryTime) / 2;
        pattern.lastSeen = Date.now();
      }
    }
  }

  /**
   * Handle circuit breaker state changes
   */
  private handleCircuitBreakerOpen(data: { operationKey: string }): void {
    sharedStorageLogger.logWarn('Circuit breaker opened - adjusting retry strategy', {
      operationKey: data.operationKey,
      event: 'circuit_breaker_opened'
    });

    // Increase retry delays for this operation type
    this.adjustRetryStrategy(data.operationKey, 'circuit_open');
  }

  private handleCircuitBreakerClose(data: { operationKey: string }): void {
    sharedStorageLogger.logInfo('Circuit breaker closed - resuming normal retry strategy', {
      operationKey: data.operationKey,
      event: 'circuit_breaker_closed'
    });

    // Reset retry strategy to normal
    this.adjustRetryStrategy(data.operationKey, 'circuit_closed');
  }

  private handleCircuitBreakerHalfOpen(data: { operationKey: string }): void {
    sharedStorageLogger.logInfo('Circuit breaker half-open - cautious retry strategy', {
      operationKey: data.operationKey,
      event: 'circuit_breaker_half_open'
    });

    // Use cautious retry strategy
    this.adjustRetryStrategy(data.operationKey, 'circuit_half_open');
  }

  /**
   * Adjust retry strategy based on circuit breaker state
   */
  private adjustRetryStrategy(operationKey: string, state: string): void {
    // Implementation would adjust retry configurations based on circuit breaker state
    // This could involve modifying retry budgets, delays, or error classification
  }

  /**
   * Get retry configuration for operation context
   */
  private getRetryConfig(context: RetryOperationContext): RetryConfig {
    // Get operation-specific config or use default
    const operationConfig = this.config.operationSpecificConfigs?.[context.operationType];
    return { ...this.config.defaultRetryConfig, ...operationConfig };
  }

  /**
   * Generate circuit breaker key from operation context
   */
  private getCircuitBreakerKey(context: RetryOperationContext): string {
    return `${context.operationType}_${context.service || 'unknown'}`;
  }

  /**
   * Utility methods
   */
  private generateOperationId(): string {
    return `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private cleanupExpiredContexts(): void {
    const now = Date.now();
    const expiredIds: string[] = [];

    for (const [id, context] of this.retryContexts.entries()) {
      if (now - context.startTime > this.config.contextExpirationTime) {
        expiredIds.push(id);
      }
    }

    expiredIds.forEach(id => this.retryContexts.delete(id));

    // Reset retry budgets periodically
    for (const budget of this.retryBudgets.values()) {
      if (now > budget.resetTime) {
        budget.currentUsage = 0;
        budget.lastReset = now;
        budget.resetTime = now + this.config.budgetResetInterval;
      }
    }
  }

  private recordRetryContext(context: RetryExecutionContext): void {
    sharedStorageMetrics.recordAccessMetrics(
      'retry_execution',
      'retry-manager',
      Date.now() - context.startTime,
      context.status === 'success'
    );
  }

  /**
   * Get retry manager statistics
   */
  getRetryStatistics(): RetryManagerStatistics {
    const totalRetries = Array.from(this.retryContexts.values()).length;
    const successfulRetries = Array.from(this.retryContexts.values())
      .filter(ctx => ctx.status === 'success').length;
    const failedRetries = Array.from(this.retryContexts.values())
      .filter(ctx => ctx.status === 'failed').length;

    return {
      totalRetries,
      successfulRetries,
      failedRetries,
      successRate: totalRetries > 0 ? successfulRetries / totalRetries : 0,
      activeContexts: this.retryContexts.size,
      activeBudgets: this.retryBudgets.size,
      circuitBreakerStatuses: this.circuitBreaker.getAllBreakerStatuses()
    };
  }
}
