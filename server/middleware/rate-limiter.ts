/**
 * Rate Limiting Middleware
 * 
 * Task 12.10: Server-side rate limiting to prevent API abuse
 * 
 * Features:
 * - Per-IP rate limiting
 * - Configurable time windows
 * - 429 Too Many Requests response
 * - Rate limit headers
 */

import type { Request, Response, NextFunction } from 'express';

// ============================================================================
// Types
// ============================================================================

interface RateLimitConfig {
  windowMs: number;    // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;    // Custom error message
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  keyGenerator?: (req: Request) => string; // Custom key generator
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// ============================================================================
// Rate Limiter Class
// ============================================================================

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig) {
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      message: config.message || 'Too many requests, please try again later.',
      skipSuccessfulRequests: config.skipSuccessfulRequests ?? false,
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator
    };

    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Default key generator uses IP address
   */
  private defaultKeyGenerator(req: Request): string {
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.store.entries()) {
      if (entry.resetTime <= now) {
        this.store.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[RateLimiter] Cleaned up ${cleaned} expired entries`);
    }
  }

  /**
   * Middleware function
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const key = this.config.keyGenerator(req);
      const now = Date.now();

      // Get or create entry
      let entry = this.store.get(key);

      if (!entry || entry.resetTime <= now) {
        // Create new entry
        entry = {
          count: 0,
          resetTime: now + this.config.windowMs
        };
        this.store.set(key, entry);
      }

      // Increment request count
      entry.count++;

      // Calculate remaining requests
      const remaining = Math.max(0, this.config.maxRequests - entry.count);
      const resetTime = Math.ceil((entry.resetTime - now) / 1000); // seconds

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', this.config.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', resetTime.toString());

      // Check if limit exceeded
      if (entry.count > this.config.maxRequests) {
        res.setHeader('Retry-After', resetTime.toString());
        
        return res.status(429).json({
          error: 'Too Many Requests',
          message: this.config.message,
          limit: this.config.maxRequests,
          remaining: 0,
          resetIn: resetTime
        });
      }

      // Continue to next middleware
      next();
    };
  }

  /**
   * Get current rate limit info for a key
   */
  getInfo(key: string): { count: number; remaining: number; resetIn: number } | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    const now = Date.now();
    const resetIn = Math.max(0, Math.ceil((entry.resetTime - now) / 1000));
    const remaining = Math.max(0, this.config.maxRequests - entry.count);

    return {
      count: entry.count,
      remaining,
      resetIn
    };
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Get statistics
   */
  getStats(): { totalKeys: number; totalRequests: number } {
    let totalRequests = 0;
    
    for (const entry of this.store.values()) {
      totalRequests += entry.count;
    }

    return {
      totalKeys: this.store.size,
      totalRequests
    };
  }
}

// ============================================================================
// Preset Configurations
// ============================================================================

/**
 * Strict rate limiting for authentication endpoints
 * 5 requests per minute
 */
export const strictRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5,
  message: 'Too many authentication attempts, please try again in a minute.'
});

/**
 * Standard rate limiting for API endpoints
 * 100 requests per minute
 */
export const standardRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  message: 'API rate limit exceeded, please slow down your requests.'
});

/**
 * Lenient rate limiting for validation endpoints
 * 300 requests per minute (5 per second)
 */
export const validationRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 300,
  message: 'Validation rate limit exceeded, please slow down.'
});

// Export middleware functions
export const strictRateLimit = strictRateLimiter.middleware();
export const standardRateLimit = standardRateLimiter.middleware();
export const validationRateLimit = validationRateLimiter.middleware();

