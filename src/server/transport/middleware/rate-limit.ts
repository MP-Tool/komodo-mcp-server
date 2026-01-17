/**
 * Rate limiting middleware
 * Prevents abuse and DoS attacks
 */

import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import { TransportErrorMessages } from '../core/index.js';
import { parseFrameworkEnv } from '../../config/index.js';

/**
 * Rate limiter configuration options
 */
export interface RateLimiterOptions {
  /** Time window in milliseconds (default: 900000 = 15 minutes) */
  windowMs?: number;
  /** Maximum requests per window (default: 1000) */
  max?: number;
}

/** Cached rate limiter instance (lazy initialization) */
let cachedRateLimiter: RateLimitRequestHandler | undefined;

/**
 * Creates or returns cached rate limiter for MCP endpoint.
 *
 * Uses lazy initialization to avoid circular dependency issues.
 * The config is read when the function is first called, not at module load.
 *
 * Configurable via environment variables:
 * - MCP_RATE_LIMIT_WINDOW_MS: Time window in ms (default: 900000 = 15 minutes)
 * - MCP_RATE_LIMIT_MAX: Max requests per window (default: 1000)
 *
 * @param options - Optional override for rate limit settings
 * @returns Express rate limiter middleware
 */
export function createRateLimiter(options?: RateLimiterOptions): RateLimitRequestHandler {
  if (cachedRateLimiter && !options) {
    return cachedRateLimiter;
  }

  // Lazy load config to avoid circular dependency
  const config = parseFrameworkEnv();

  const limiter = rateLimit({
    windowMs: options?.windowMs ?? config.MCP_RATE_LIMIT_WINDOW_MS,
    max: options?.max ?? config.MCP_RATE_LIMIT_MAX,
    message: TransportErrorMessages.RATE_LIMIT_EXCEEDED,
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    // Skip rate limiting for health checks
    skip: (req) => req.path === '/health' || req.path === '/ready',
  });

  if (!options) {
    cachedRateLimiter = limiter;
  }

  return limiter;
}

/**
 * Default rate limiter for MCP endpoint.
 *
 * @deprecated Use createRateLimiter() for lazy initialization.
 * This getter is provided for backwards compatibility.
 */
export function getMcpRateLimiter(): RateLimitRequestHandler {
  return createRateLimiter();
}
