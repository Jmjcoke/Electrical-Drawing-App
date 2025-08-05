"use strict";
/**
 * Rate limiting implementation for LLM API usage management
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RATE_LIMIT_PRESETS = exports.RateLimitExceededError = exports.RateLimiter = void 0;
exports.createSessionRateLimiter = createSessionRateLimiter;
exports.createProviderRateLimiter = createProviderRateLimiter;
exports.createIPRateLimiter = createIPRateLimiter;
class RateLimiter {
    constructor(config) {
        this.config = config;
        this.store = new Map();
        // Clean up expired entries every minute
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60000);
    }
    async checkLimit(identifier) {
        const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
        const now = new Date();
        let entry = this.store.get(key);
        // Create new entry if doesn't exist or if window has expired
        if (!entry || now >= entry.resetTime) {
            entry = {
                count: 0,
                resetTime: new Date(now.getTime() + this.config.windowMs),
                createdAt: now
            };
            this.store.set(key, entry);
        }
        const remaining = Math.max(0, this.config.maxRequests - entry.count);
        const isAllowed = entry.count < this.config.maxRequests;
        const rateLimitInfo = {
            limit: this.config.maxRequests,
            remaining: remaining,
            resetTime: entry.resetTime,
        };
        if (!isAllowed) {
            rateLimitInfo.retryAfter = Math.ceil((entry.resetTime.getTime() - now.getTime()) / 1000);
        }
        return rateLimitInfo;
    }
    async consume(identifier, points = 1) {
        const info = await this.checkLimit(identifier);
        if (info.remaining < points) {
            throw new RateLimitExceededError(`Rate limit exceeded for ${identifier}. Try again in ${info.retryAfter} seconds.`, info);
        }
        // Increment the counter
        const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
        const entry = this.store.get(key);
        entry.count += points;
        // Update remaining count
        info.remaining = Math.max(0, this.config.maxRequests - entry.count);
        return info;
    }
    async reset(identifier) {
        const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
        this.store.delete(key);
    }
    async resetAll() {
        this.store.clear();
    }
    getStats() {
        const now = new Date();
        let activeKeys = 0;
        let expiredKeys = 0;
        for (const entry of this.store.values()) {
            if (now < entry.resetTime) {
                activeKeys++;
            }
            else {
                expiredKeys++;
            }
        }
        return {
            totalKeys: this.store.size,
            activeKeys,
            expiredKeys
        };
    }
    cleanup() {
        const now = new Date();
        const keysToDelete = [];
        for (const [key, entry] of this.store.entries()) {
            if (now >= entry.resetTime) {
                keysToDelete.push(key);
            }
        }
        for (const key of keysToDelete) {
            this.store.delete(key);
        }
    }
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.store.clear();
    }
}
exports.RateLimiter = RateLimiter;
class RateLimitExceededError extends Error {
    constructor(message, rateLimitInfo) {
        super(message);
        this.rateLimitInfo = rateLimitInfo;
        this.name = 'RateLimitExceededError';
    }
}
exports.RateLimitExceededError = RateLimitExceededError;
// Predefined rate limit configurations for different use cases
exports.RATE_LIMIT_PRESETS = {
    // OpenAI rate limits (conservative estimates)
    OPENAI_GPT4_VISION: {
        maxRequests: 100,
        windowMs: 60 * 1000, // 1 minute
    },
    // Per-session limits to prevent abuse
    PER_SESSION: {
        maxRequests: 20,
        windowMs: 10 * 60 * 1000, // 10 minutes
    },
    // Per-IP limits for general protection
    PER_IP: {
        maxRequests: 100,
        windowMs: 15 * 60 * 1000, // 15 minutes
    },
    // Development/testing limits
    DEVELOPMENT: {
        maxRequests: 1000,
        windowMs: 60 * 1000, // 1 minute
    }
};
// Factory functions for common rate limiters
function createSessionRateLimiter() {
    return new RateLimiter({
        ...exports.RATE_LIMIT_PRESETS.PER_SESSION,
        keyGenerator: (sessionId) => `session:${sessionId}`
    });
}
function createProviderRateLimiter(provider) {
    let preset;
    switch (provider.toLowerCase()) {
        case 'openai':
            preset = exports.RATE_LIMIT_PRESETS.OPENAI_GPT4_VISION;
            break;
        default:
            preset = exports.RATE_LIMIT_PRESETS.PER_SESSION;
    }
    return new RateLimiter({
        ...preset,
        keyGenerator: (identifier) => `provider:${provider}:${identifier}`
    });
}
function createIPRateLimiter() {
    return new RateLimiter({
        ...exports.RATE_LIMIT_PRESETS.PER_IP,
        keyGenerator: (ip) => `ip:${ip}`
    });
}
//# sourceMappingURL=rate-limiter.js.map