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
export declare enum BackoffStrategy {
    LINEAR = "LINEAR",
    EXPONENTIAL = "EXPONENTIAL",
    FIXED = "FIXED"
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
export declare class TokenBucketRateLimiter implements RateLimiter {
    private readonly config;
    private readonly name;
    private tokens;
    private lastRefill;
    private requestHistory;
    private requestQueue;
    constructor(config: RateLimitConfig, name?: string);
    canMakeRequest(tokens?: number): RateLimitStatus;
    acquirePermission(tokens?: number): Promise<RateLimitResult>;
    recordRequest(tokens: number, success: boolean): void;
    getStatus(): RateLimitStatus;
    reset(): void;
    /**
     * Refills tokens based on time passed
     */
    private refillTokens;
    /**
     * Consumes tokens from the bucket
     */
    private consumeTokens;
    /**
     * Checks all configured limits
     */
    private checkAllLimits;
    /**
     * Calculates remaining requests/tokens for each time window
     */
    private calculateRemaining;
    /**
     * Calculates reset times for each time window
     */
    private calculateResetTimes;
    /**
     * Calculates retry after time in seconds
     */
    private calculateRetryAfter;
    /**
     * Queues a request for later processing
     */
    private queueRequest;
    /**
     * Processes queued requests
     */
    private processQueue;
    /**
     * Starts token refill and queue processing
     */
    private startTokenRefill;
    /**
     * Cleans old records to prevent memory leaks
     */
    private cleanOldRecords;
}
/**
 * Sliding window rate limiter implementation
 */
export declare class SlidingWindowRateLimiter implements RateLimiter {
    private readonly config;
    private readonly name;
    private requestHistory;
    constructor(config: RateLimitConfig, name?: string);
    canMakeRequest(tokens?: number): RateLimitStatus;
    acquirePermission(tokens?: number): Promise<RateLimitResult>;
    recordRequest(tokens: number, success: boolean): void;
    getStatus(): RateLimitStatus;
    reset(): void;
    private calculateRetryAfter;
    private cleanOldRecords;
}
/**
 * Rate limit exceeded error
 */
export declare class RateLimitExceededError extends Error {
    readonly limiterName: string;
    readonly retryAfter: number;
    constructor(message: string, limiterName: string, retryAfter: number);
}
/**
 * Factory for creating rate limiters with common configurations
 */
export declare class RateLimiterFactory {
    /**
     * Creates a rate limiter for OpenAI API
     */
    static createForOpenAI(): RateLimiter;
    /**
     * Creates a rate limiter for Anthropic Claude API
     */
    static createForClaude(): RateLimiter;
    /**
     * Creates a rate limiter for Google Gemini API
     */
    static createForGemini(): RateLimiter;
    /**
     * Creates a custom rate limiter
     */
    static createCustom(config: RateLimitConfig, name: string, type?: 'token-bucket' | 'sliding-window'): RateLimiter;
}
/**
 * Manager for multiple rate limiters
 */
export declare class RateLimiterManager {
    private readonly limiters;
    /**
     * Adds a rate limiter for a provider
     */
    addLimiter(providerId: string, limiter: RateLimiter): void;
    /**
     * Gets a rate limiter for a provider
     */
    getLimiter(providerId: string): RateLimiter | undefined;
    /**
     * Checks if a request can be made for a provider
     */
    canMakeRequest(providerId: string, tokens?: number): boolean;
    /**
     * Acquires permission for a request
     */
    acquirePermission(providerId: string, tokens?: number): Promise<RateLimitResult>;
    /**
     * Records a request for a provider
     */
    recordRequest(providerId: string, tokens: number, success: boolean): void;
    /**
     * Gets status for all rate limiters
     */
    getAllStatus(): Map<string, RateLimitStatus>;
    /**
     * Resets all rate limiters
     */
    resetAll(): void;
    /**
     * Removes a rate limiter
     */
    removeLimiter(providerId: string): boolean;
}
//# sourceMappingURL=RateLimiter.d.ts.map