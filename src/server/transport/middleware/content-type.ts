import { Request, Response, NextFunction } from 'express';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { HttpStatus, TransportErrorMessage } from '../../../config/index.js';

/**
 * Validates that POST requests have the correct Content-Type header
 * MCP Specification: POST requests must use application/json
 */
export function validateContentType(req: Request, res: Response, next: NextFunction) {
  // Only applies to POST requests
  if (req.method !== 'POST') {
    return next();
  }

  const contentType = req.headers['content-type'];

  if (!contentType || !contentType.includes('application/json')) {
    res.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: ErrorCode.InvalidRequest,
        message: TransportErrorMessage.INVALID_CONTENT_TYPE,
      },
    });
    return;
  }

  next();
}
