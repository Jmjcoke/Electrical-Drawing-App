/**
 * Rate Limiting Framework
 * 
 * Implements various rate limiting strategies for LLM providers to prevent
 * API quota exhaustion and ensure fair resource usage across requests.
 */

export interface RateLimitConfig {
  readonly requestsPerMinute: number;
  readonly requestsPerHour?: number;
  readonly requestsPerDay?: number;
  readonly tokensPerMinute?: number;
  readonly tokensPerHour?: number;
  readonly tokensPerDay?: number;
  readonly burstLimit?: number;
  readonly queueLimit?: number;
  readonly backoffStrategy: BackoffStrategy;
}

export enum BackoffStrategy {
  LINEAR = 'LINEAR',
  EXPONENTIAL = 'EXPONENTIAL',
  FIXED = 'FIXED'
}

export interface RateLimitStatus {
  readonly allowed: boolean;
  readonly remaining: {
    requestsPerMinute: number;
    requestsPerHour?: number;
    requestsPerDay?: number;
    tokensPerMinute?: number;
    tokensPerHour?: number;
    tokensPerDay?: number;
  };
  readonly resetTimes: {
    minute: Date;
    hour?: Date;
    day?: Date;
  };
  readonly retryAfter?: number | undefined;
  readonly queuePosition?: number | undefined;
}

export interface RequestRecord {
  readonly timestamp: Date;
  readonly tokens: number;
  readonly success: boolean;
}

export interface RateLimitResult {
  readonly success: boolean;
  readonly retryAfter?: number | undefined;
  readonly queuePosition?: number | undefined;
  readonly error?: Error;
}

/**
 * Rate limiter interface for different strategies
 */
export interface RateLimiter {
  /**
   * Checks if a request can be made immediately
   */
  canMakeRequest(tokens?: number): RateLimitStatus;

  /**
   * Attempts to acquire permission for a request
   */
  acquirePermission(tokens?: number): Promise<RateLimitResult>;

  /**
   * Records a completed request for tracking
   */
  recordRequest(tokens: number, success: boolean): void;

  /**
   * Gets current rate limit status
   */
  getStatus(): RateLimitStatus;

  /**
   * Resets rate limit counters
   */
  reset(): void;
}

/**
 * Token bucket rate limiter implementation
 */
export class TokenBucketRateLimiter implements RateLimiter {
  private tokens: number;
  private lastRefill: Date;
  private requestHistory: RequestRecord[] = [];
  private requestQueue: Array<{
    resolve: (result: RateLimitResult) => void;
    reject: (error: Error) => void;
    tokens: number;
    timestamp: Date;
  }> = [];

  constructor(
    private readonly config: RateLimitConfig,
    private readonly name: string = 'TokenBucket'
  ) {
    this.tokens = config.requestsPerMinute;
    this.lastRefill = new Date();
    this.startTokenRefill();
  }

  public canMakeRequest(tokens: number = 1): RateLimitStatus {
    this.refillTokens();
    this.cleanOldRecords();

    const allowed = this.tokens >= tokens && this.checkAllLimits(tokens);

    return {
      allowed,
      remaining: this.calculateRemaining(),
      resetTimes: this.calculateResetTimes(),
      retryAfter: allowed ? undefined : this.calculateRetryAfter(),
      queuePosition: this.requestQueue.length > 0 ? this.requestQueue.length : undefined
    };
  }

  public async acquirePermission(tokens: number = 1): Promise<RateLimitResult> {
    const status = this.canMakeRequest(tokens);

    if (status.allowed) {
      this.consumeTokens(tokens);
      return { success: true };
    }

    // If queue is enabled and not full, queue the request
    if (this.config.queueLimit && this.requestQueue.length < this.config.queueLimit) {
      return this.queueRequest(tokens);
    }

    // Otherwise return rate limit error
    return {
      success: false,
      retryAfter: status.retryAfter,
      error: new RateLimitExceededError(
        `Rate limit exceeded for ${this.name}. Retry after ${status.retryAfter} seconds`,
        this.name,
        status.retryAfter || 0
      )
    };
  }

  public recordRequest(tokens: number, success: boolean): void {
    const record: RequestRecord = {
      timestamp: new Date(),
      tokens,
      success
    };

    this.requestHistory.push(record);
    this.cleanOldRecords();
  }

  public getStatus(): RateLimitStatus {
    return this.canMakeRequest(1);
  }

  public reset(): void {
    this.tokens = this.config.requestsPerMinute;
    this.lastRefill = new Date();
    this.requestHistory = [];
    this.requestQueue = [];
  }

  /**
   * Refills tokens based on time passed
   */
  private refillTokens(): void {
    const now = new Date();
    const timePassed = now.getTime() - this.lastRefill.getTime();
    const tokensToAdd = Math.floor((timePassed / 60000) * this.config.requestsPerMinute);

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.config.requestsPerMinute, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  /**
   * Consumes tokens from the bucket
   */
  private consumeTokens(tokens: number): void {
    this.tokens = Math.max(0, this.tokens - tokens);
  }

  /**
   * Checks all configured limits
   */
  private checkAllLimits(tokens: number): boolean {
    const now = new Date();

    // Check hourly limits
    if (this.config.requestsPerHour || this.config.tokensPerHour) {
      const hourAgo = new Date(now.getTime() - 3600000);
      const hourlyRequests = this.requestHistory.filter(r => r.timestamp > hourAgo);
      
      if (this.config.requestsPerHour && hourlyRequests.length >= this.config.requestsPerHour) {
        return false;
      }

      if (this.config.tokensPerHour) {
        const hourlyTokens = hourlyRequests.reduce((sum, r) => sum + r.tokens, 0);
        if (hourlyTokens + tokens > this.config.tokensPerHour) {
          return false;
        }
      }
    }

    // Check daily limits
    if (this.config.requestsPerDay || this.config.tokensPerDay) {
      const dayAgo = new Date(now.getTime() - 86400000);
      const dailyRequests = this.requestHistory.filter(r => r.timestamp > dayAgo);
      
      if (this.config.requestsPerDay && dailyRequests.length >= this.config.requestsPerDay) {
        return false;
      }

      if (this.config.tokensPerDay) {
        const dailyTokens = dailyRequests.reduce((sum, r) => sum + r.tokens, 0);
        if (dailyTokens + tokens > this.config.tokensPerDay) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Calculates remaining requests/tokens for each time window
   */
  private calculateRemaining(): RateLimitStatus['remaining'] {
    const now = new Date();
    
    // Minute remaining
    const remaining: RateLimitStatus['remaining'] = {
      requestsPerMinute: Math.max(0, this.tokens)
    };

    // Hour remaining
    if (this.config.requestsPerHour || this.config.tokensPerHour) {
      const hourAgo = new Date(now.getTime() - 3600000);
      const hourlyRequests = this.requestHistory.filter(r => r.timestamp > hourAgo);
      
      if (this.config.requestsPerHour) {
        remaining.requestsPerHour = Math.max(0, this.config.requestsPerHour - hourlyRequests.length);
      }

      if (this.config.tokensPerHour) {
        const hourlyTokens = hourlyRequests.reduce((sum, r) => sum + r.tokens, 0);
        remaining.tokensPerHour = Math.max(0, this.config.tokensPerHour - hourlyTokens);
      }
    }

    // Day remaining
    if (this.config.requestsPerDay || this.config.tokensPerDay) {
      const dayAgo = new Date(now.getTime() - 86400000);
      const dailyRequests = this.requestHistory.filter(r => r.timestamp > dayAgo);
      
      if (this.config.requestsPerDay) {
        remaining.requestsPerDay = Math.max(0, this.config.requestsPerDay - dailyRequests.length);
      }

      if (this.config.tokensPerDay) {
        const dailyTokens = dailyRequests.reduce((sum, r) => sum + r.tokens, 0);
        remaining.tokensPerDay = Math.max(0, this.config.tokensPerDay - dailyTokens);
      }
    }

    return remaining;
  }

  /**
   * Calculates reset times for each time window
   */
  private calculateResetTimes(): RateLimitStatus['resetTimes'] {
    const now = new Date();
    
    return {
      minute: new Date(Math.ceil(now.getTime() / 60000) * 60000),
      hour: new Date(Math.ceil(now.getTime() / 3600000) * 3600000),
      day: new Date(Math.ceil(now.getTime() / 86400000) * 86400000)
    };
  }

  /**
   * Calculates retry after time in seconds
   */
  private calculateRetryAfter(): number {
    const resetTimes = this.calculateResetTimes();
    const now = new Date();
    
    // Return time until next minute reset
    return Math.ceil((resetTimes.minute.getTime() - now.getTime()) / 1000);
  }

  /**
   * Queues a request for later processing
   */
  private async queueRequest(tokens: number): Promise<RateLimitResult> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        resolve,
        reject,
        tokens,
        timestamp: new Date()
      });

      // Set timeout for queued request
      setTimeout(() => {
        const index = this.requestQueue.findIndex(q => q.resolve === resolve);
        if (index !== -1) {
          this.requestQueue.splice(index, 1);
          reject(new Error('Request timeout in queue'));
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Processes queued requests
   */
  private processQueue(): void {
    while (this.requestQueue.length > 0) {
      const status = this.canMakeRequest(this.requestQueue[0].tokens);
      
      if (!status.allowed) {
        break; // Can't process more requests
      }

      const request = this.requestQueue.shift()!;
      this.consumeTokens(request.tokens);
      request.resolve({ success: true });
    }
  }

  /**
   * Starts token refill and queue processing
   */
  private startTokenRefill(): void {
    setInterval(() => {
      this.refillTokens();
      this.processQueue();
    }, 1000); // Check every second
  }

  /**
   * Cleans old records to prevent memory leaks
   */
  private cleanOldRecords(): void {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 86400000);
    
    this.requestHistory = this.requestHistory.filter(r => r.timestamp > dayAgo);
  }
}

/**
 * Sliding window rate limiter implementation
 */
export class SlidingWindowRateLimiter implements RateLimiter {
  private requestHistory: RequestRecord[] = [];

  constructor(
    private readonly config: RateLimitConfig,
    private readonly name: string = 'SlidingWindow'
  ) {}

  public canMakeRequest(tokens?: number): RateLimitStatus {
    // Note: tokens parameter reserved for future token-based sliding window logic
    // Currently unused but kept for interface compatibility
    void tokens;
    
    this.cleanOldRecords();
    
    const now = new Date();
    const minuteAgo = new Date(now.getTime() - 60000);
    const recentRequests = this.requestHistory.filter(r => r.timestamp > minuteAgo);
    
    const allowed = recentRequests.length < this.config.requestsPerMinute;

    return {
      allowed,
      remaining: {
        requestsPerMinute: Math.max(0, this.config.requestsPerMinute - recentRequests.length)
      },
      resetTimes: {
        minute: new Date(now.getTime() + 60000)
      },
      retryAfter: allowed ? undefined : this.calculateRetryAfter()
    };
  }

  public async acquirePermission(tokens: number = 1): Promise<RateLimitResult> {
    const status = this.canMakeRequest(tokens);

    if (status.allowed) {
      this.recordRequest(tokens, true);
      return { success: true };
    }

    return {
      success: false,
      retryAfter: status.retryAfter,
      error: new RateLimitExceededError(
        `Rate limit exceeded for ${this.name}. Retry after ${status.retryAfter} seconds`,
        this.name,
        status.retryAfter || 0
      )
    };
  }

  public recordRequest(tokens: number, success: boolean): void {
    this.requestHistory.push({
      timestamp: new Date(),
      tokens,
      success
    });

    this.cleanOldRecords();
  }

  public getStatus(): RateLimitStatus {
    return this.canMakeRequest(1);
  }

  public reset(): void {
    this.requestHistory = [];
  }

  private calculateRetryAfter(): number {
    if (this.requestHistory.length === 0) {
      return 1;
    }

    const oldestRequest = this.requestHistory[0];
    const retryTime = oldestRequest.timestamp.getTime() + 60000;
    const now = Date.now();
    
    return Math.max(1, Math.ceil((retryTime - now) / 1000));
  }

  private cleanOldRecords(): void {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 86400000); // Keep 24 hours of history
    
    this.requestHistory = this.requestHistory.filter(r => r.timestamp > cutoff);
  }
}

/**
 * Rate limit exceeded error
 */
export class RateLimitExceededError extends Error {
  constructor(
    message: string,
    public readonly limiterName: string,
    public readonly retryAfter: number
  ) {
    super(message);
    this.name = 'RateLimitExceededError';
  }
}

/**
 * Factory for creating rate limiters with common configurations
 */
export class RateLimiterFactory {
  /**
   * Creates a rate limiter for OpenAI API
   */
  public static createForOpenAI(): RateLimiter {
    const config: RateLimitConfig = {
      requestsPerMinute: 60,
      requestsPerHour: 3500,
      requestsPerDay: 10000,
      tokensPerMinute: 90000,
      tokensPerHour: 5000000,
      burstLimit: 10,
      queueLimit: 50,
      backoffStrategy: BackoffStrategy.EXPONENTIAL
    };

    return new TokenBucketRateLimiter(config, 'OpenAI');
  }

  /**
   * Creates a rate limiter for Anthropic Claude API
   */
  public static createForClaude(): RateLimiter {
    const config: RateLimitConfig = {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      requestsPerDay: 5000,
      tokensPerMinute: 40000,
      tokensPerHour: 400000,
      burstLimit: 5,
      queueLimit: 30,
      backoffStrategy: BackoffStrategy.EXPONENTIAL
    };

    return new TokenBucketRateLimiter(config, 'Claude');
  }

  /**
   * Creates a rate limiter for Google Gemini API
   */
  public static createForGemini(): RateLimiter {
    const config: RateLimitConfig = {
      requestsPerMinute: 15,
      requestsPerHour: 1500,
      requestsPerDay: 15000,
      tokensPerMinute: 32000,
      tokensPerHour: 1000000,
      burstLimit: 5,
      queueLimit: 25,
      backoffStrategy: BackoffStrategy.LINEAR
    };

    return new TokenBucketRateLimiter(config, 'Gemini');
  }

  /**
   * Creates a custom rate limiter
   */
  public static createCustom(
    config: RateLimitConfig,
    name: string,
    type: 'token-bucket' | 'sliding-window' = 'token-bucket'
  ): RateLimiter {
    if (type === 'sliding-window') {
      return new SlidingWindowRateLimiter(config, name);
    }
    
    return new TokenBucketRateLimiter(config, name);
  }
}

/**
 * Manager for multiple rate limiters
 */
export class RateLimiterManager {
  private readonly limiters = new Map<string, RateLimiter>();

  /**
   * Adds a rate limiter for a provider
   */
  public addLimiter(providerId: string, limiter: RateLimiter): void {
    this.limiters.set(providerId, limiter);
  }

  /**
   * Gets a rate limiter for a provider
   */
  public getLimiter(providerId: string): RateLimiter | undefined {
    return this.limiters.get(providerId);
  }

  /**
   * Checks if a request can be made for a provider
   */
  public canMakeRequest(providerId: string, tokens?: number): boolean {
    const limiter = this.limiters.get(providerId);
    if (!limiter) {
      return true; // No limiter means no restrictions
    }

    return limiter.canMakeRequest(tokens).allowed;
  }

  /**
   * Acquires permission for a request
   */
  public async acquirePermission(providerId: string, tokens?: number): Promise<RateLimitResult> {
    const limiter = this.limiters.get(providerId);
    if (!limiter) {
      return { success: true }; // No limiter means no restrictions
    }

    return limiter.acquirePermission(tokens);
  }

  /**
   * Records a request for a provider
   */
  public recordRequest(providerId: string, tokens: number, success: boolean): void {
    const limiter = this.limiters.get(providerId);
    if (limiter) {
      limiter.recordRequest(tokens, success);
    }
  }

  /**
   * Gets status for all rate limiters
   */
  public getAllStatus(): Map<string, RateLimitStatus> {
    const statusMap = new Map<string, RateLimitStatus>();
    
    for (const [providerId, limiter] of this.limiters) {
      statusMap.set(providerId, limiter.getStatus());
    }

    return statusMap;
  }

  /**
   * Resets all rate limiters
   */
  public resetAll(): void {
    for (const limiter of this.limiters.values()) {
      limiter.reset();
    }
  }

  /**
   * Removes a rate limiter
   */
  public removeLimiter(providerId: string): boolean {
    return this.limiters.delete(providerId);
  }
}