/**
 * Rate limiting middleware
 * Prevents abuse and DoS attacks
 */

import rateLimit from 'express-rate-limit';
import { config } from '../../../config/index.js';

/**
 * Creates rate limiter for MCP endpoint
 *
 * Configurable via environment variables:
 * - MCP_RATE_LIMIT_WINDOW_MS: Time window in ms (default: 900000 = 15 minutes)
 * - MCP_RATE_LIMIT_MAX: Max requests per window (default: 1000)
 *
 * This allows for heavy MCP usage while still preventing abuse.
 */
export const mcpRateLimiter = rateLimit({
  windowMs: config.MCP_RATE_LIMIT_WINDOW_MS,
  max: config.MCP_RATE_LIMIT_MAX,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/health' || req.path === '/ready',
});
