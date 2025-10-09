import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Express, Request } from 'express';
import logger from '../utils/logger';

/**
 * Security Configuration Module
 * 
 * Integrates Helmet.js, CORS, and rate limiting for production security
 */

// ============================================================================
// Helmet Configuration
// ============================================================================

/**
 * Configure Helmet.js for security headers
 */
export const helmetConfig = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for React
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for Tailwind
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  // Prevent clickjacking
  frameguard: { action: 'deny' },
  // Hide X-Powered-By header
  hidePoweredBy: true,
  // Enable HSTS (HTTP Strict Transport Security)
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  // Prevent MIME type sniffing
  noSniff: true,
  // Enable XSS filter
  xssFilter: true,
});

// ============================================================================
// CORS Configuration
// ============================================================================

/**
 * CORS configuration based on environment
 */
export const corsConfig = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    // In development, allow all origins
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    // In production, whitelist specific origins
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    logger.warn(`[Security] Blocked CORS request from unauthorized origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Server-Id',
    'If-Match', // For ETag conflict detection
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'ETag',
  ],
  maxAge: 86400, // 24 hours
};

// ============================================================================
// Rate Limiting Configuration
// ============================================================================

/**
 * General API rate limiter
 */
export const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  message: 'Too many requests from this IP, please try again later.',
  handler: (req, res) => {
    logger.warn(`[Security] Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
    });
  },
  skip: (req) => {
    // Skip rate limiting for health check endpoints
    return req.path.startsWith('/api/health');
  },
});

/**
 * Strict rate limiter for write operations (edit/create/delete)
 */
export const strictWriteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 write operations per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many write operations, please slow down.',
  handler: (req, res) => {
    logger.warn(`[Security] Write rate limit exceeded for IP: ${req.ip}, path: ${req.path}`);
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many write operations. Please try again later.',
    });
  },
  // Use default keyGenerator which handles IPv6 correctly
});

/**
 * Very strict rate limiter for batch operations
 */
export const batchOperationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 batch operations per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many batch operations, please slow down.',
  handler: (req, res) => {
    logger.warn(`[Security] Batch operation rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many batch operations. Please try again later.',
    });
  },
});

/**
 * Strict rate limiter for validation operations
 */
export const validationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 validation operations per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many validation operations, please slow down.',
  handler: (req, res) => {
    logger.warn(`[Security] Validation rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many validation operations. Please try again later.',
    });
  },
});

// ============================================================================
// Security Middleware Setup
// ============================================================================

/**
 * Apply all security middleware to the Express app
 */
export function setupSecurityMiddleware(app: Express) {
  // Apply Helmet security headers
  app.use(helmetConfig);

  // General API rate limiting
  app.use('/api', generalApiLimiter);

  logger.info('[Security] Security middleware configured successfully');
  logger.info(`[Security] Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`[Security] CORS: ${process.env.NODE_ENV === 'development' ? 'All origins allowed' : 'Whitelist enforced'}`);
}

/**
 * Export rate limiters for specific routes
 */
export const rateLimiters = {
  general: generalApiLimiter,
  strictWrite: strictWriteLimiter,
  batchOperation: batchOperationLimiter,
  validation: validationLimiter,
};

