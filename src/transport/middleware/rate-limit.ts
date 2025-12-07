/**
 * Rate limiting middleware
 * Prevents abuse and DoS attacks
 */

import rateLimit from 'express-rate-limit';

/**
 * Creates rate limiter for MCP endpoint
 * 100 requests per 15 minutes per IP
 */
export const mcpRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
