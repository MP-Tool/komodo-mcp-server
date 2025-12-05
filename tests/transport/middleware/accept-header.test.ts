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
      headers: {}
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

  it('should reject requests without Accept header (non-POST)', () => {
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

  it('should reject invalid Accept header', () => {
    req.headers = { accept: 'text/html' };
    validateAcceptHeader(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ message: expect.stringContaining('Accept header must include') })
    }));
    expect(next).not.toHaveBeenCalled();
  });
});
