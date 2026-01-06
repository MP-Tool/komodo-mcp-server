import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateAcceptHeader } from '../../../src/transport/middleware/accept-header.js';
import { Request, Response, NextFunction } from 'express';

describe('Accept Header Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      method: 'GET',
      headers: {},
      query: {} // Required for middleware that checks query.sessionId
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    next = vi.fn();
  });

  it('should allow POST requests without Accept header', () => {
    req.method = 'POST';
    validateAcceptHeader(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('should allow GET without session and without Accept header (legacy endpoint event)', () => {
    // Legacy flow: GET without session should be allowed without Accept header
    req.method = 'GET';
    req.headers = {}; // No Accept header
    req.query = {}; // No session ID
    validateAcceptHeader(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('should reject GET with session but without Accept header', () => {
    req.method = 'GET';
    req.headers = { 'mcp-session-id': 'some-session-id' } as Record<string, string>;
    req.query = {};
    validateAcceptHeader(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ message: 'Missing Accept header' })
    }));
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow application/json', () => {
    req.headers = { accept: 'application/json' };
    validateAcceptHeader(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('should allow text/event-stream', () => {
    req.headers = { accept: 'text/event-stream' };
    validateAcceptHeader(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('should allow */*', () => {
    req.headers = { accept: '*/*' };
    validateAcceptHeader(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('should reject invalid Accept header for GET with session', () => {
    req.method = 'GET';
    req.headers = { accept: 'text/html', 'mcp-session-id': 'some-session' } as Record<string, string>;
    req.query = {};
    validateAcceptHeader(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ message: expect.stringContaining('Accept header must include') })
    }));
    expect(next).not.toHaveBeenCalled();
  });
});
