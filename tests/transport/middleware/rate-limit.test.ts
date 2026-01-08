import { describe, it, expect, vi } from 'vitest';

const { mockRateLimit } = vi.hoisted(() => {
  return { mockRateLimit: vi.fn().mockReturnValue(() => {}) };
});

vi.mock('express-rate-limit', () => ({
  default: mockRateLimit
}));

import { mcpRateLimiter } from '../../../src/transport/middleware/rate-limit.js';

describe('Rate Limit Middleware', () => {
  it('should be configured correctly', () => {
    expect(mockRateLimit).toHaveBeenCalledWith(expect.objectContaining({
      windowMs: 15 * 60 * 1000,
      max: 1000, // Increased for MCP workloads (was 100)
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false
    }));
    
    expect(typeof mcpRateLimiter).toBe('function');
  });
});
