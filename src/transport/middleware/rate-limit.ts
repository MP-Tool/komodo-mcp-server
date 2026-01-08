/**
 * Rate limiting middleware
 * Prevents abuse and DoS attacks
 */

import rateLimit from 'express-rate-limit';

/**
 * Creates rate limiter for MCP endpoint
 *
 * Default: 1000 requests per 15 minutes per IP
 * This allows for heavy MCP usage while still preventing abuse.
 *
 * For production deployments with stricter requirements,
 * consider using environment variables to configure limits.
 */
export const mcpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for health checks
  skip: (req) => req.path === '/health' || req.path === '/ready',
});
