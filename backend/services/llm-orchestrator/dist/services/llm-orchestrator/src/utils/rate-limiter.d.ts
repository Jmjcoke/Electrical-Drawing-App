/**
 * Rate limiting implementation for LLM API usage management
 */
export interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
    keyGenerator?: (identifier: string) => string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
}
export interface RateLimitInfo {
    limit: number;
    remaining: number;
    resetTime: Date;
    retryAfter?: number;
}
export interface RateLimitEntry {
    count: number;
    resetTime: Date;
    createdAt: Date;
}
export declare class RateLimiter {
    private config;
    private store;
    private cleanupInterval;
    constructor(config: RateLimitConfig);
    checkLimit(identifier: string): Promise<RateLimitInfo>;
    consume(identifier: string, points?: number): Promise<RateLimitInfo>;
    reset(identifier: string): Promise<void>;
    resetAll(): Promise<void>;
    getStats(): {
        totalKeys: number;
        activeKeys: number;
        expiredKeys: number;
    };
    private cleanup;
    destroy(): void;
}
export declare class RateLimitExceededError extends Error {
    rateLimitInfo: RateLimitInfo;
    constructor(message: string, rateLimitInfo: RateLimitInfo);
}
export declare const RATE_LIMIT_PRESETS: {
    OPENAI_GPT4_VISION: {
        maxRequests: number;
        windowMs: number;
    };
    PER_SESSION: {
        maxRequests: number;
        windowMs: number;
    };
    PER_IP: {
        maxRequests: number;
        windowMs: number;
    };
    DEVELOPMENT: {
        maxRequests: number;
        windowMs: number;
    };
};
export declare function createSessionRateLimiter(): RateLimiter;
export declare function createProviderRateLimiter(provider: string): RateLimiter;
export declare function createIPRateLimiter(): RateLimiter;
//# sourceMappingURL=rate-limiter.d.ts.map