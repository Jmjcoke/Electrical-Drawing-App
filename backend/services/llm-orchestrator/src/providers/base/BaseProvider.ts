/**
 * Base Provider Implementation
 * 
 * Provides common functionality for all LLM providers including:
 * - Request/response logging
 * - Error handling
 * - Rate limiting validation
 * - Metrics collection
 */

import {
  LLMProvider,
  LLMResponse,
  AnalysisOptions,
  RateLimitInfo,
  ProviderMetadata,
  ProviderError,
  ConfigurationError,
  RateLimitError,
  AnalysisError
} from './LLMProvider.interface';

export interface BaseProviderConfig {
  readonly apiKey: string;
  readonly timeout?: number;
  readonly maxRetries?: number;
  readonly baseUrl?: string;
  readonly rateLimit?: {
    requestsPerMinute: number;
    dailyLimit?: number;
  };
}

export interface RequestMetrics {
  readonly startTime: number;
  readonly endTime?: number;
  readonly duration?: number;
  readonly tokensUsed?: number;
  readonly success: boolean;
  readonly error?: Error;
}

/**
 * Abstract base class providing common provider functionality
 */
export abstract class BaseProvider implements LLMProvider {
  protected readonly config: BaseProviderConfig;
  private requestHistory: RequestMetrics[] = [];
  private currentRateLimit: RateLimitInfo;

  constructor(config: BaseProviderConfig) {
    this.config = config;
    this.validateBaseConfig(config);
    this.currentRateLimit = this.initializeRateLimit();
  }

  // Abstract properties that must be implemented by subclasses
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly metadata: ProviderMetadata;

  // Abstract methods that must be implemented by subclasses
  abstract analyze(image: Buffer, prompt: string, options?: AnalysisOptions): Promise<LLMResponse>;
  abstract healthCheck(): Promise<boolean>;
  abstract getCost(tokens: number): number;
  abstract getRequiredConfig(): string[];

  /**
   * Gets current rate limit information
   */
  getRateLimit(): RateLimitInfo {
    this.updateRateLimitInfo();
    return this.currentRateLimit;
  }

  /**
   * Validates provider configuration
   */
  validateConfig(config: Record<string, unknown>): boolean {
    try {
      // Validate that the config has the required properties for BaseProviderConfig
      if (!config.apiKey || typeof config.apiKey !== 'string') {
        throw new Error('Missing required apiKey property');
      }
      const baseConfig = {
        apiKey: config.apiKey,
        ...(config.timeout !== undefined && { timeout: config.timeout as number }),
        ...(config.maxRetries !== undefined && { maxRetries: config.maxRetries as number }),
        ...(config.baseUrl !== undefined && { baseUrl: config.baseUrl as string }),
        ...(config.rateLimit !== undefined && { rateLimit: config.rateLimit as BaseProviderConfig['rateLimit'] })
      } as BaseProviderConfig;
      this.validateBaseConfig(baseConfig);
      return this.validateProviderSpecificConfig(config);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCause = error instanceof Error ? error : undefined;
      throw new ConfigurationError(
        `Configuration validation failed: ${errorMessage}`,
        this.name,
        errorCause
      );
    }
  }

  /**
   * Protected method for executing analysis with common error handling
   */
  protected async executeAnalysis(
    analysisFunction: () => Promise<LLMResponse>,
    options?: AnalysisOptions
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    let metrics: RequestMetrics = {
      startTime,
      success: false
    };

    try {
      // Check rate limits before making request
      this.checkRateLimit();

      // Execute the actual analysis
      const response = await this.withTimeout(
        analysisFunction(),
        options?.timeout || this.config.timeout || 30000
      );

      // Update metrics
      metrics = {
        ...metrics,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        tokensUsed: response.tokensUsed,
        success: true
      };

      this.recordRequest(metrics);
      this.updateRateLimitAfterRequest(response.tokensUsed);

      return response;

    } catch (error) {
      metrics = {
        ...metrics,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      };

      this.recordRequest(metrics);
      throw this.handleError(error);
    }
  }

  /**
   * Validates base configuration common to all providers
   */
  private validateBaseConfig(config: BaseProviderConfig): void {
    if (!config.apiKey || typeof config.apiKey !== 'string' || config.apiKey.trim() === '') {
      throw new Error('API key is required and must be a non-empty string');
    }

    if (config.timeout !== undefined && (typeof config.timeout !== 'number' || config.timeout <= 0)) {
      throw new Error('Timeout must be a positive number');
    }

    if (config.maxRetries !== undefined && (typeof config.maxRetries !== 'number' || config.maxRetries < 0)) {
      throw new Error('Max retries must be a non-negative number');
    }
  }

  /**
   * Provider-specific configuration validation (override in subclasses)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected validateProviderSpecificConfig(_config: Record<string, unknown>): boolean {
    return true;
  }

  /**
   * Initializes rate limit information
   */
  private initializeRateLimit(): RateLimitInfo {
    const defaultLimit = this.config.rateLimit?.requestsPerMinute || 60;
    const dailyLimit = this.config.rateLimit?.dailyLimit;

    return {
      requestsPerMinute: defaultLimit,
      requestsRemaining: defaultLimit,
      resetTime: new Date(Date.now() + 60000), // 1 minute from now
      ...(dailyLimit !== undefined && { dailyLimit }),
      dailyUsed: 0
    };
  }

  /**
   * Updates rate limit information based on recent requests
   */
  private updateRateLimitInfo(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean old requests and count recent ones
    this.requestHistory = this.requestHistory.filter(req => req.startTime > oneMinuteAgo);
    const recentRequests = this.requestHistory.length;

    // Update rate limit info
    this.currentRateLimit = {
      ...this.currentRateLimit,
      requestsRemaining: Math.max(0, this.currentRateLimit.requestsPerMinute - recentRequests),
      resetTime: new Date(Math.max(...this.requestHistory.map(r => r.startTime)) + 60000)
    };
  }

  /**
   * Checks if request can be made within rate limits
   */
  private checkRateLimit(): void {
    this.updateRateLimitInfo();

    if (this.currentRateLimit.requestsRemaining <= 0) {
      const retryAfter = Math.ceil((this.currentRateLimit.resetTime.getTime() - Date.now()) / 1000);
      throw new RateLimitError(
        `Rate limit exceeded. Retry after ${retryAfter} seconds`,
        this.name,
        retryAfter
      );
    }
  }

  /**
   * Records request metrics
   */
  private recordRequest(metrics: RequestMetrics): void {
    this.requestHistory.push(metrics);
    
    // Keep only last 1000 requests to prevent memory issues
    if (this.requestHistory.length > 1000) {
      this.requestHistory = this.requestHistory.slice(-1000);
    }
  }

  /**
   * Updates rate limit info after successful request
   */
  private updateRateLimitAfterRequest(tokensUsed: number): void {
    // Update daily usage if daily limits are configured
    if (this.currentRateLimit.dailyLimit !== undefined) {
      this.currentRateLimit = {
        ...this.currentRateLimit,
        dailyUsed: (this.currentRateLimit.dailyUsed || 0) + tokensUsed
      };
    }
  }

  /**
   * Wraps a promise with timeout
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Handles and wraps errors in appropriate error types
   */
  private handleError(error: any): ProviderError {
    if (error instanceof ProviderError) {
      return error;
    }

    // Check for common error patterns
    if (error.message?.includes('timeout') || error.code === 'ETIMEDOUT') {
      return new AnalysisError(`Request timeout: ${error.message}`, this.name, error);
    }

    if (error.message?.includes('rate limit') || error.status === 429) {
      const retryAfter = this.extractRetryAfterFromError(error);
      return new RateLimitError(`Rate limit exceeded: ${error.message}`, this.name, retryAfter, error);
    }

    if (error.status >= 400 && error.status < 500) {
      return new ConfigurationError(`Client error: ${error.message}`, this.name, error);
    }

    // Default to analysis error
    return new AnalysisError(`Analysis failed: ${error.message}`, this.name, error);
  }

  /**
   * Extracts retry-after value from error response
   */
  private extractRetryAfterFromError(error: any): number {
    // Try to extract from headers
    if (error.response?.headers?.['retry-after']) {
      return parseInt(error.response.headers['retry-after'], 10) || 60;
    }

    // Default retry after 60 seconds
    return 60;
  }

  /**
   * Gets request history for monitoring/debugging
   */
  protected getRequestHistory(): ReadonlyArray<RequestMetrics> {
    return [...this.requestHistory];
  }

  /**
   * Gets performance metrics
   */
  protected getPerformanceMetrics(): {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    totalTokensUsed: number;
  } {
    const total = this.requestHistory.length;
    const successful = this.requestHistory.filter(r => r.success).length;
    const failed = total - successful;
    
    const durations = this.requestHistory
      .filter(r => r.duration !== undefined)
      .map(r => r.duration!);
    
    const averageResponseTime = durations.length > 0 
      ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length 
      : 0;

    const totalTokensUsed = this.requestHistory
      .filter(r => r.tokensUsed !== undefined)
      .reduce((sum, r) => sum + (r.tokensUsed || 0), 0);

    return {
      totalRequests: total,
      successfulRequests: successful,
      failedRequests: failed,
      averageResponseTime,
      totalTokensUsed
    };
  }
}