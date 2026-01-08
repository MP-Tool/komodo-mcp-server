import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateJsonRpc } from '../../../src/transport/middleware/json-rpc.js';
import { TransportErrorMessage } from '../../../src/config/index.js';
import { Request, Response, NextFunction } from 'express';

describe('JSON-RPC Middleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {
      method: 'POST',
      body: {}
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    next = vi.fn();
  });

  it('should ignore non-POST requests', () => {
    req.method = 'GET';
    validateJsonRpc(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('should reject invalid body type', () => {
    req.body = null;
    validateJsonRpc(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ message: TransportErrorMessage.INVALID_JSON })
    }));
  });

  it('should reject empty batch', () => {
    req.body = [];
    validateJsonRpc(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ message: TransportErrorMessage.INVALID_JSONRPC_BATCH })
    }));
  });

  it('should reject invalid JSON-RPC version in batch', () => {
    req.body = [{ jsonrpc: '1.0', method: 'test' }];
    validateJsonRpc(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ message: expect.stringContaining('Invalid JSON-RPC version') })
    }));
  });

  it('should allow valid batch', () => {
    req.body = [{ jsonrpc: '2.0', method: 'test' }];
    validateJsonRpc(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('should reject invalid JSON-RPC version in single request', () => {
    req.body = { jsonrpc: '1.0', method: 'test' };
    validateJsonRpc(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('should allow valid single request', () => {
    req.body = { jsonrpc: '2.0', method: 'test' };
    validateJsonRpc(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
  });
});
