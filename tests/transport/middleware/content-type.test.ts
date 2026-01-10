import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateContentType } from '../../../src/transport/middleware/content-type.js';
import { Request, Response, NextFunction } from 'express';

describe('Content-Type Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      method: 'POST',
      headers: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    next = vi.fn();
  });

  it('should ignore non-POST requests', () => {
    req.method = 'GET';
    validateContentType(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('should allow application/json', () => {
    req.headers = { 'content-type': 'application/json' };
    validateContentType(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('should allow application/json with charset', () => {
    req.headers = { 'content-type': 'application/json; charset=utf-8' };
    validateContentType(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('should reject missing Content-Type', () => {
    validateContentType(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(415);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({ message: expect.stringContaining('Content-Type must be application/json') }),
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('should reject invalid Content-Type', () => {
    req.headers = { 'content-type': 'text/plain' };
    validateContentType(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(415);
    expect(next).not.toHaveBeenCalled();
  });
});
