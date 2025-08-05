"use strict";
/**
 * Rate Limiting Framework
 *
 * Implements various rate limiting strategies for LLM providers to prevent
 * API quota exhaustion and ensure fair resource usage across requests.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimiterManager = exports.RateLimiterFactory = exports.RateLimitExceededError = exports.SlidingWindowRateLimiter = exports.TokenBucketRateLimiter = exports.BackoffStrategy = void 0;
var BackoffStrategy;
(function (BackoffStrategy) {
    BackoffStrategy["LINEAR"] = "LINEAR";
    BackoffStrategy["EXPONENTIAL"] = "EXPONENTIAL";
    BackoffStrategy["FIXED"] = "FIXED";
})(BackoffStrategy || (exports.BackoffStrategy = BackoffStrategy = {}));
/**
 * Token bucket rate limiter implementation
 */
class TokenBucketRateLimiter {
    constructor(config, name = 'TokenBucket') {
        this.config = config;
        this.name = name;
        this.requestHistory = [];
        this.requestQueue = [];
        this.tokens = config.requestsPerMinute;
        this.lastRefill = new Date();
        this.startTokenRefill();
    }
    canMakeRequest(tokens = 1) {
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
    async acquirePermission(tokens = 1) {
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
            error: new RateLimitExceededError(`Rate limit exceeded for ${this.name}. Retry after ${status.retryAfter} seconds`, this.name, status.retryAfter || 0)
        };
    }
    recordRequest(tokens, success) {
        const record = {
            timestamp: new Date(),
            tokens,
            success
        };
        this.requestHistory.push(record);
        this.cleanOldRecords();
    }
    getStatus() {
        return this.canMakeRequest(1);
    }
    reset() {
        this.tokens = this.config.requestsPerMinute;
        this.lastRefill = new Date();
        this.requestHistory = [];
        this.requestQueue = [];
    }
    /**
     * Refills tokens based on time passed
     */
    refillTokens() {
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
    consumeTokens(tokens) {
        this.tokens = Math.max(0, this.tokens - tokens);
    }
    /**
     * Checks all configured limits
     */
    checkAllLimits(tokens) {
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
    calculateRemaining() {
        const now = new Date();
        // Minute remaining
        const remaining = {
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
    calculateResetTimes() {
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
    calculateRetryAfter() {
        const resetTimes = this.calculateResetTimes();
        const now = new Date();
        // Return time until next minute reset
        return Math.ceil((resetTimes.minute.getTime() - now.getTime()) / 1000);
    }
    /**
     * Queues a request for later processing
     */
    async queueRequest(tokens) {
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
    processQueue() {
        while (this.requestQueue.length > 0) {
            const status = this.canMakeRequest(this.requestQueue[0].tokens);
            if (!status.allowed) {
                break; // Can't process more requests
            }
            const request = this.requestQueue.shift();
            this.consumeTokens(request.tokens);
            request.resolve({ success: true });
        }
    }
    /**
     * Starts token refill and queue processing
     */
    startTokenRefill() {
        setInterval(() => {
            this.refillTokens();
            this.processQueue();
        }, 1000); // Check every second
    }
    /**
     * Cleans old records to prevent memory leaks
     */
    cleanOldRecords() {
        const now = new Date();
        const dayAgo = new Date(now.getTime() - 86400000);
        this.requestHistory = this.requestHistory.filter(r => r.timestamp > dayAgo);
    }
}
exports.TokenBucketRateLimiter = TokenBucketRateLimiter;
/**
 * Sliding window rate limiter implementation
 */
class SlidingWindowRateLimiter {
    constructor(config, name = 'SlidingWindow') {
        this.config = config;
        this.name = name;
        this.requestHistory = [];
    }
    canMakeRequest(tokens) {
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
    async acquirePermission(tokens = 1) {
        const status = this.canMakeRequest(tokens);
        if (status.allowed) {
            this.recordRequest(tokens, true);
            return { success: true };
        }
        return {
            success: false,
            retryAfter: status.retryAfter,
            error: new RateLimitExceededError(`Rate limit exceeded for ${this.name}. Retry after ${status.retryAfter} seconds`, this.name, status.retryAfter || 0)
        };
    }
    recordRequest(tokens, success) {
        this.requestHistory.push({
            timestamp: new Date(),
            tokens,
            success
        });
        this.cleanOldRecords();
    }
    getStatus() {
        return this.canMakeRequest(1);
    }
    reset() {
        this.requestHistory = [];
    }
    calculateRetryAfter() {
        if (this.requestHistory.length === 0) {
            return 1;
        }
        const oldestRequest = this.requestHistory[0];
        const retryTime = oldestRequest.timestamp.getTime() + 60000;
        const now = Date.now();
        return Math.max(1, Math.ceil((retryTime - now) / 1000));
    }
    cleanOldRecords() {
        const now = new Date();
        const cutoff = new Date(now.getTime() - 86400000); // Keep 24 hours of history
        this.requestHistory = this.requestHistory.filter(r => r.timestamp > cutoff);
    }
}
exports.SlidingWindowRateLimiter = SlidingWindowRateLimiter;
/**
 * Rate limit exceeded error
 */
class RateLimitExceededError extends Error {
    constructor(message, limiterName, retryAfter) {
        super(message);
        this.limiterName = limiterName;
        this.retryAfter = retryAfter;
        this.name = 'RateLimitExceededError';
    }
}
exports.RateLimitExceededError = RateLimitExceededError;
/**
 * Factory for creating rate limiters with common configurations
 */
class RateLimiterFactory {
    /**
     * Creates a rate limiter for OpenAI API
     */
    static createForOpenAI() {
        const config = {
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
    static createForClaude() {
        const config = {
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
    static createForGemini() {
        const config = {
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
    static createCustom(config, name, type = 'token-bucket') {
        if (type === 'sliding-window') {
            return new SlidingWindowRateLimiter(config, name);
        }
        return new TokenBucketRateLimiter(config, name);
    }
}
exports.RateLimiterFactory = RateLimiterFactory;
/**
 * Manager for multiple rate limiters
 */
class RateLimiterManager {
    constructor() {
        this.limiters = new Map();
    }
    /**
     * Adds a rate limiter for a provider
     */
    addLimiter(providerId, limiter) {
        this.limiters.set(providerId, limiter);
    }
    /**
     * Gets a rate limiter for a provider
     */
    getLimiter(providerId) {
        return this.limiters.get(providerId);
    }
    /**
     * Checks if a request can be made for a provider
     */
    canMakeRequest(providerId, tokens) {
        const limiter = this.limiters.get(providerId);
        if (!limiter) {
            return true; // No limiter means no restrictions
        }
        return limiter.canMakeRequest(tokens).allowed;
    }
    /**
     * Acquires permission for a request
     */
    async acquirePermission(providerId, tokens) {
        const limiter = this.limiters.get(providerId);
        if (!limiter) {
            return { success: true }; // No limiter means no restrictions
        }
        return limiter.acquirePermission(tokens);
    }
    /**
     * Records a request for a provider
     */
    recordRequest(providerId, tokens, success) {
        const limiter = this.limiters.get(providerId);
        if (limiter) {
            limiter.recordRequest(tokens, success);
        }
    }
    /**
     * Gets status for all rate limiters
     */
    getAllStatus() {
        const statusMap = new Map();
        for (const [providerId, limiter] of this.limiters) {
            statusMap.set(providerId, limiter.getStatus());
        }
        return statusMap;
    }
    /**
     * Resets all rate limiters
     */
    resetAll() {
        for (const limiter of this.limiters.values()) {
            limiter.reset();
        }
    }
    /**
     * Removes a rate limiter
     */
    removeLimiter(providerId) {
        return this.limiters.delete(providerId);
    }
}
exports.RateLimiterManager = RateLimiterManager;
//# sourceMappingURL=RateLimiter.js.map