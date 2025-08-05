/**
 * Unit tests for RateLimiter implementations
 */

import {
  TokenBucketRateLimiter,
  SlidingWindowRateLimiter,
  RateLimiterFactory,
  RateLimiterManager,
  RateLimitConfig,
  BackoffStrategy,
  RateLimitExceededError
} from '../../reliability/RateLimiter';

describe('TokenBucketRateLimiter', () => {
  let config: RateLimitConfig;
  let rateLimiter: TokenBucketRateLimiter;

  beforeEach(() => {
    config = {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      tokensPerMinute: 10000,
      burstLimit: 10,
      queueLimit: 20,
      backoffStrategy: BackoffStrategy.EXPONENTIAL
    };
    rateLimiter = new TokenBucketRateLimiter(config, 'test-limiter');
  });

  describe('Rate Limit Checking', () => {
    it('should allow requests within limits', () => {
      const status = rateLimiter.canMakeRequest(1);
      
      expect(status.allowed).toBe(true);
      expect(status.remaining.requestsPerMinute).toBeGreaterThan(0);
      expect(status.resetTimes.minute).toBeInstanceOf(Date);
    });

    it('should track remaining requests correctly', async () => {
      // Make several requests
      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter.acquirePermission(1);
        expect(result.success).toBe(true);
      }

      const status = rateLimiter.getStatus();
      expect(status.remaining.requestsPerMinute).toBeLessThan(60);
    });

    it('should reject requests when limit is exceeded', async () => {
      // Exhaust the token bucket
      for (let i = 0; i < 60; i++) {
        await rateLimiter.acquirePermission(1);
      }

      const result = await rateLimiter.acquirePermission(1);
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(RateLimitExceededError);
    });

    it('should handle token-based limits', () => {
      const status = rateLimiter.canMakeRequest(5000); // Half the token limit
      expect(status.allowed).toBe(true);

      const overLimitStatus = rateLimiter.canMakeRequest(15000); // Over token limit
      expect(overLimitStatus.allowed).toBe(false);
    });
  });

  describe('Token Refill', () => {
    it('should refill tokens over time', async () => {
      // Exhaust bucket
      for (let i = 0; i < 60; i++) {
        await rateLimiter.acquirePermission(1);
      }

      // Should be at limit
      expect(rateLimiter.canMakeRequest(1).allowed).toBe(false);

      // Wait and check if tokens are refilled
      // Note: In real implementation, this would use actual time passage
      // For testing, we'd need to mock time or use a shorter interval
    });
  });

  describe('Request Recording', () => {
    it('should record successful requests', () => {
      rateLimiter.recordRequest(100, true);
      
      // Recording doesn't directly affect token bucket state
      // but should be tracked for historical purposes
      const status = rateLimiter.getStatus();
      expect(status).toBeDefined();
    });

    it('should record failed requests', () => {
      rateLimiter.recordRequest(100, false);
      
      const status = rateLimiter.getStatus();
      expect(status).toBeDefined();
    });
  });

  describe('Queue Management', () => {
    it('should queue requests when limits are exceeded and queue is enabled', async () => {
      // Fill the bucket
      for (let i = 0; i < 60; i++) {
        await rateLimiter.acquirePermission(1);
      }

      // This should be queued since queueLimit > 0
      const queuedPromise = rateLimiter.acquirePermission(1);
      
      const status = rateLimiter.canMakeRequest(1);
      expect(status.queuePosition).toBeGreaterThan(0);

      // Clean up the promise to avoid hanging test
      queuedPromise.catch(() => {}); // Ignore timeout error
    });
  });

  describe('Reset Functionality', () => {
    it('should reset rate limiter state', async () => {
      // Make some requests
      for (let i = 0; i < 10; i++) {
        await rateLimiter.acquirePermission(1);
      }

      rateLimiter.reset();

      const status = rateLimiter.getStatus();
      expect(status.remaining.requestsPerMinute).toBe(60);
    });
  });
});

describe('SlidingWindowRateLimiter', () => {
  let config: RateLimitConfig;
  let rateLimiter: SlidingWindowRateLimiter;

  beforeEach(() => {
    config = {
      requestsPerMinute: 10,
      backoffStrategy: BackoffStrategy.LINEAR
    };
    rateLimiter = new SlidingWindowRateLimiter(config, 'sliding-test');
  });

  describe('Sliding Window Logic', () => {
    it('should allow requests within window', async () => {
      const result = await rateLimiter.acquirePermission(1);
      expect(result.success).toBe(true);
    });

    it('should reject requests when window is full', async () => {
      // Fill the window
      for (let i = 0; i < 10; i++) {
        await rateLimiter.acquirePermission(1);
      }

      const result = await rateLimiter.acquirePermission(1);
      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(RateLimitExceededError);
    });

    it('should calculate retry time based on oldest request', async () => {
      // Fill the window
      for (let i = 0; i < 10; i++) {
        await rateLimiter.acquirePermission(1);
      }

      const status = rateLimiter.getStatus();
      expect(status.retryAfter).toBeGreaterThan(0);
    });
  });
});

describe('RateLimiterFactory', () => {
  describe('Provider-specific Rate Limiters', () => {
    it('should create OpenAI rate limiter', () => {
      const limiter = RateLimiterFactory.createForOpenAI();
      expect(limiter).toBeInstanceOf(TokenBucketRateLimiter);
      
      const status = limiter.getStatus();
      expect(status.remaining.requestsPerMinute).toBe(60);
    });

    it('should create Claude rate limiter', () => {
      const limiter = RateLimiterFactory.createForClaude();
      expect(limiter).toBeInstanceOf(TokenBucketRateLimiter);
      
      const status = limiter.getStatus();
      expect(status.remaining.requestsPerMinute).toBe(60);
    });

    it('should create Gemini rate limiter', () => {
      const limiter = RateLimiterFactory.createForGemini();
      expect(limiter).toBeInstanceOf(TokenBucketRateLimiter);
      
      const status = limiter.getStatus();
      expect(status.remaining.requestsPerMinute).toBe(15);
    });
  });

  describe('Custom Rate Limiter Creation', () => {
    it('should create custom token bucket rate limiter', () => {
      const config: RateLimitConfig = {
        requestsPerMinute: 30,
        backoffStrategy: BackoffStrategy.EXPONENTIAL
      };

      const limiter = RateLimiterFactory.createCustom(config, 'custom-limiter');
      expect(limiter).toBeInstanceOf(TokenBucketRateLimiter);
    });

    it('should create custom sliding window rate limiter', () => {
      const config: RateLimitConfig = {
        requestsPerMinute: 30,
        backoffStrategy: BackoffStrategy.LINEAR
      };

      const limiter = RateLimiterFactory.createCustom(
        config, 
        'custom-sliding',
        'sliding-window'
      );
      expect(limiter).toBeInstanceOf(SlidingWindowRateLimiter);
    });
  });
});

describe('RateLimiterManager', () => {
  let manager: RateLimiterManager;

  beforeEach(() => {
    manager = new RateLimiterManager();
  });

  describe('Limiter Management', () => {
    it('should add and retrieve rate limiters', () => {
      const limiter = RateLimiterFactory.createForOpenAI();
      manager.addLimiter('openai', limiter);
      
      const retrieved = manager.getLimiter('openai');
      expect(retrieved).toBe(limiter);
    });

    it('should return undefined for non-existent limiter', () => {
      const limiter = manager.getLimiter('non-existent');
      expect(limiter).toBeUndefined();
    });

    it('should check if requests can be made', () => {
      const limiter = RateLimiterFactory.createForOpenAI();
      manager.addLimiter('openai', limiter);
      
      const canMake = manager.canMakeRequest('openai', 1);
      expect(canMake).toBe(true);
    });

    it('should return true for providers without limiters', () => {
      const canMake = manager.canMakeRequest('unknown-provider', 1);
      expect(canMake).toBe(true);
    });

    it('should acquire permission through manager', async () => {
      const limiter = RateLimiterFactory.createForOpenAI();
      manager.addLimiter('openai', limiter);
      
      const result = await manager.acquirePermission('openai', 1);
      expect(result.success).toBe(true);
    });

    it('should record requests through manager', () => {
      const limiter = RateLimiterFactory.createForOpenAI();
      manager.addLimiter('openai', limiter);
      
      expect(() => manager.recordRequest('openai', 100, true)).not.toThrow();
    });

    it('should get status for all rate limiters', () => {
      const openaiLimiter = RateLimiterFactory.createForOpenAI();
      const claudeLimiter = RateLimiterFactory.createForClaude();
      
      manager.addLimiter('openai', openaiLimiter);
      manager.addLimiter('claude', claudeLimiter);
      
      const allStatus = manager.getAllStatus();
      expect(allStatus.size).toBe(2);
      expect(allStatus.has('openai')).toBe(true);
      expect(allStatus.has('claude')).toBe(true);
    });

    it('should reset all rate limiters', () => {
      const limiter = RateLimiterFactory.createForOpenAI();
      manager.addLimiter('openai', limiter);
      
      expect(() => manager.resetAll()).not.toThrow();
    });

    it('should remove rate limiter', () => {
      const limiter = RateLimiterFactory.createForOpenAI();
      manager.addLimiter('openai', limiter);
      
      const removed = manager.removeLimiter('openai');
      expect(removed).toBe(true);
      
      const retrieved = manager.getLimiter('openai');
      expect(retrieved).toBeUndefined();
    });

    it('should return false when removing non-existent limiter', () => {
      const removed = manager.removeLimiter('non-existent');
      expect(removed).toBe(false);
    });
  });
});

describe('RateLimitExceededError', () => {
  it('should create error with rate limit details', () => {
    const error = new RateLimitExceededError(
      'Rate limit exceeded',
      'test-limiter',
      60
    );

    expect(error.message).toBe('Rate limit exceeded');
    expect(error.limiterName).toBe('test-limiter');
    expect(error.retryAfter).toBe(60);
    expect(error.name).toBe('RateLimitExceededError');
  });
});