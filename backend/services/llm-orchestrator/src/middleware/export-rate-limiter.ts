/**
 * Export Rate Limiting Middleware
 * Prevents DoS attacks on export endpoints by implementing rate limiting
 * Security fix for Story 4.5 production hardening
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimiter } from '../reliability/RateLimiter';

interface ExportRateLimiterConfig {
  windowMs: number;          // Time window in milliseconds
  maxRequests: number;       // Maximum requests per window
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request, res: Response) => void;
}

interface RateLimitInfo {
  requests: number;
  resetTime: number;
  windowStart: number;
}

export class ExportRateLimiter {
  private rateLimitMap: Map<string, RateLimitInfo> = new Map();
  private config: Required<ExportRateLimiterConfig>;

  constructor(config: ExportRateLimiterConfig) {
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      skipSuccessfulRequests: config.skipSuccessfulRequests || false,
      skipFailedRequests: config.skipFailedRequests || false,
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator,
      onLimitReached: config.onLimitReached || this.defaultLimitReachedHandler
    };
  }

  /**
   * Express middleware for rate limiting
   */
  public middleware() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const key = this.config.keyGenerator(req);
        const now = Date.now();
        
        // Clean up expired entries
        this.cleanup(now);
        
        // Get or create rate limit info for this key
        let rateLimitInfo = this.rateLimitMap.get(key);
        
        if (!rateLimitInfo || now - rateLimitInfo.windowStart >= this.config.windowMs) {
          // Start new window
          rateLimitInfo = {
            requests: 0,
            resetTime: now + this.config.windowMs,
            windowStart: now
          };
        }

        // Check if limit exceeded
        if (rateLimitInfo.requests >= this.config.maxRequests) {
          // Rate limit exceeded
          res.set({
            'X-RateLimit-Limit': this.config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(rateLimitInfo.resetTime / 1000).toString(),
            'Retry-After': Math.ceil((rateLimitInfo.resetTime - now) / 1000).toString()
          });
          
          this.config.onLimitReached(req, res);
          return;
        }

        // Increment request count
        rateLimitInfo.requests++;
        this.rateLimitMap.set(key, rateLimitInfo);

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': this.config.maxRequests.toString(),
          'X-RateLimit-Remaining': Math.max(0, this.config.maxRequests - rateLimitInfo.requests).toString(),
          'X-RateLimit-Reset': Math.ceil(rateLimitInfo.resetTime / 1000).toString()
        });

        // Continue to next middleware
        next();
      } catch (error) {
        console.error('Rate limiter error:', error);
        // Don't block request on rate limiter errors
        next();
      }
    };
  }

  /**
   * Default key generator - uses IP address and user agent
   */
  private defaultKeyGenerator(req: Request): string {
    const ip = this.getClientIP(req);
    const userAgent = req.get('User-Agent') || 'unknown';
    return `${ip}:${Buffer.from(userAgent).toString('base64').substring(0, 16)}`;
  }

  /**
   * Get client IP address considering proxies
   */
  private getClientIP(req: Request): string {
    return (
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Default handler when rate limit is reached
   */
  private defaultLimitReachedHandler(req: Request, res: Response): void {
    const ip = this.getClientIP(req);
    console.warn(`Rate limit exceeded for ${ip} on ${req.path}`);
    
    res.status(429).json({
      error: 'Too many export requests',
      message: 'Rate limit exceeded. Please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }

  /**
   * Clean up expired entries from memory
   */
  private cleanup(now: number): void {
    for (const [key, info] of this.rateLimitMap.entries()) {
      if (now - info.windowStart >= this.config.windowMs) {
        this.rateLimitMap.delete(key);
      }
    }
  }

  /**
   * Get current rate limit status for a key
   */
  public getStatus(req: Request): RateLimitInfo | null {
    const key = this.config.keyGenerator(req);
    return this.rateLimitMap.get(key) || null;
  }

  /**
   * Reset rate limit for a specific key
   */
  public reset(req: Request): void {
    const key = this.config.keyGenerator(req);
    this.rateLimitMap.delete(key);
  }

  /**
   * Clear all rate limit data
   */
  public clear(): void {
    this.rateLimitMap.clear();
  }
}

// Pre-configured rate limiters for different export operations
export const createExportRateLimiter = () => new ExportRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10,           // 10 exports per 15 minutes per IP
  keyGenerator: (req) => {
    // Rate limit by IP and session if available
    const ip = req.ip || 'unknown';
    const sessionId = req.params.sessionId || 'no-session';
    return `export:${ip}:${sessionId}`;
  }
});

export const createDownloadRateLimiter = () => new ExportRateLimiter({
  windowMs: 5 * 60 * 1000,   // 5 minutes
  maxRequests: 50,           // 50 downloads per 5 minutes per IP
  keyGenerator: (req) => {
    const ip = req.ip || 'unknown';
    return `download:${ip}`;
  }
});

export const createPreviewRateLimiter = () => new ExportRateLimiter({
  windowMs: 1 * 60 * 1000,   // 1 minute
  maxRequests: 20,           // 20 previews per minute per IP
  keyGenerator: (req) => {
    const ip = req.ip || 'unknown';
    return `preview:${ip}`;
  }
});

export const createTemplateRateLimiter = () => new ExportRateLimiter({
  windowMs: 10 * 60 * 1000,  // 10 minutes
  maxRequests: 100,          // 100 template requests per 10 minutes per IP
  keyGenerator: (req) => {
    const ip = req.ip || 'unknown';
    return `template:${ip}`;
  }
});