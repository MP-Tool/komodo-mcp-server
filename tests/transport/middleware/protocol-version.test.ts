import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateProtocolVersion } from '../../../src/transport/middleware/protocol-version.js';
import { Request, Response, NextFunction } from 'express';

vi.mock('../../../src/config/transport.config.js', () => ({
  SUPPORTED_PROTOCOL_VERSIONS: ['2024-11-05'],
  FALLBACK_PROTOCOL_VERSION: '2024-11-05'
}));

describe('Protocol Version Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      headers: {}
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    next = vi.fn();
  });

  it('should set fallback version if header is missing', () => {
    validateProtocolVersion(req as Request, res as Response, next);
    expect(req.headers!['mcp-protocol-version']).toBe('2024-11-05');
    expect(next).toHaveBeenCalled();
  });

  it('should allow supported version', () => {
    req.headers = { 'mcp-protocol-version': '2024-11-05' };
    validateProtocolVersion(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('should reject unsupported version', () => {
    req.headers = { 'mcp-protocol-version': '1.0.0' };
    validateProtocolVersion(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ message: expect.stringContaining('Unsupported MCP-Protocol-Version') })
    }));
    expect(next).not.toHaveBeenCalled();
  });
});
