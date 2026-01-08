import { Request, Response, NextFunction } from 'express';
import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { logger as baseLogger } from '../../utils/logger.js';
import { HttpStatus, TransportErrorMessage } from '../../config/index.js';

const logger = baseLogger.child({ component: 'middleware' });

/**
 * Validates that the request body is a valid JSON-RPC 2.0 message
 */
export function validateJsonRpc(req: Request, res: Response, next: NextFunction) {
  // Only applies to POST requests
  if (req.method !== 'POST') {
    return next();
  }

  const body = req.body;

  // Check if body exists and is an object (express.json() should have parsed it)
  if (!body || typeof body !== 'object') {
    res.status(HttpStatus.BAD_REQUEST).json({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: ErrorCode.ParseError,
        message: TransportErrorMessage.INVALID_JSON,
      },
    });
    return;
  }

  // Check for JSON-RPC 2.0 compliance
  if (Array.isArray(body)) {
    if (body.length === 0) {
      res.status(HttpStatus.BAD_REQUEST).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: ErrorCode.InvalidRequest,
          message: TransportErrorMessage.INVALID_JSONRPC_BATCH,
        },
      });
      return;
    }

    // Validate each message in the batch
    for (const message of body) {
      if (!message || typeof message !== 'object' || message.jsonrpc !== '2.0') {
        res.status(HttpStatus.BAD_REQUEST).json({
          jsonrpc: '2.0',
          id: message?.id || null,
          error: {
            code: ErrorCode.InvalidRequest,
            message: TransportErrorMessage.INVALID_JSONRPC_VERSION,
          },
        });
        return;
      }
    }
  } else {
    // Single message validation
    // Must have jsonrpc: "2.0"
    if (body.jsonrpc !== '2.0') {
      logger.warn('Invalid JSON-RPC version:', JSON.stringify(body));
      res.status(HttpStatus.BAD_REQUEST).json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: ErrorCode.InvalidRequest,
          message: TransportErrorMessage.INVALID_JSONRPC_VERSION,
        },
      });
      return;
    }

    // Must have method (for requests) or result/error (for responses, but client sends requests)
    // Actually, client sends requests or notifications.
    if (!body.method) {
      res.status(HttpStatus.BAD_REQUEST).json({
        jsonrpc: '2.0',
        id: body.id || null,
        error: {
          code: ErrorCode.InvalidRequest,
          message: TransportErrorMessage.MISSING_JSONRPC_METHOD,
        },
      });
      return;
    }
  }

  next();
}
