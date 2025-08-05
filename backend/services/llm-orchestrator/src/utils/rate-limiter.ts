/**
 * Rate limiting implementation for LLM API usage management
 */

export interface RateLimitConfig {
  maxRequests: number;          // Maximum requests allowed
  windowMs: number;             // Time window in milliseconds
  keyGenerator?: (identifier: string) => string;  // Custom key generation
  skipSuccessfulRequests?: boolean;  // Only count failed requests
  skipFailedRequests?: boolean;      // Only count successful requests
}

export interface RateLimitInfo {
  limit: number;                // Maximum requests allowed
  remaining: number;            // Requests remaining in current window
  resetTime: Date;              // When the current window resets
  retryAfter?: number;          // Seconds until next request allowed
}

export interface RateLimitEntry {
  count: number;
  resetTime: Date;
  createdAt: Date;
}

export class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private config: RateLimitConfig) {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  async checkLimit(identifier: string): Promise<RateLimitInfo> {
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

    const rateLimitInfo: RateLimitInfo = {
      limit: this.config.maxRequests,
      remaining: remaining,
      resetTime: entry.resetTime,
    };

    if (!isAllowed) {
      rateLimitInfo.retryAfter = Math.ceil((entry.resetTime.getTime() - now.getTime()) / 1000);
    }

    return rateLimitInfo;
  }

  async consume(identifier: string, points: number = 1): Promise<RateLimitInfo> {
    const info = await this.checkLimit(identifier);
    
    if (info.remaining < points) {
      throw new RateLimitExceededError(
        `Rate limit exceeded for ${identifier}. Try again in ${info.retryAfter} seconds.`,
        info
      );
    }

    // Increment the counter
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
    const entry = this.store.get(key)!;
    entry.count += points;
    
    // Update remaining count
    info.remaining = Math.max(0, this.config.maxRequests - entry.count);
    
    return info;
  }

  async reset(identifier: string): Promise<void> {
    const key = this.config.keyGenerator ? this.config.keyGenerator(identifier) : identifier;
    this.store.delete(key);
  }

  async resetAll(): Promise<void> {
    this.store.clear();
  }

  getStats(): {
    totalKeys: number;
    activeKeys: number;
    expiredKeys: number;
  } {
    const now = new Date();
    let activeKeys = 0;
    let expiredKeys = 0;

    for (const entry of this.store.values()) {
      if (now < entry.resetTime) {
        activeKeys++;
      } else {
        expiredKeys++;
      }
    }

    return {
      totalKeys: this.store.size,
      activeKeys,
      expiredKeys
    };
  }

  private cleanup(): void {
    const now = new Date();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.store.entries()) {
      if (now >= entry.resetTime) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.store.delete(key);
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.store.clear();
  }
}

export class RateLimitExceededError extends Error {
  constructor(
    message: string,
    public rateLimitInfo: RateLimitInfo
  ) {
    super(message);
    this.name = 'RateLimitExceededError';
  }
}

// Predefined rate limit configurations for different use cases
export const RATE_LIMIT_PRESETS = {
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
export function createSessionRateLimiter(): RateLimiter {
  return new RateLimiter({
    ...RATE_LIMIT_PRESETS.PER_SESSION,
    keyGenerator: (sessionId: string) => `session:${sessionId}`
  });
}

export function createProviderRateLimiter(provider: string): RateLimiter {
  let preset;
  
  switch (provider.toLowerCase()) {
    case 'openai':
      preset = RATE_LIMIT_PRESETS.OPENAI_GPT4_VISION;
      break;
    default:
      preset = RATE_LIMIT_PRESETS.PER_SESSION;
  }

  return new RateLimiter({
    ...preset,
    keyGenerator: (identifier: string) => `provider:${provider}:${identifier}`
  });
}

export function createIPRateLimiter(): RateLimiter {
  return new RateLimiter({
    ...RATE_LIMIT_PRESETS.PER_IP,
    keyGenerator: (ip: string) => `ip:${ip}`
  });
}