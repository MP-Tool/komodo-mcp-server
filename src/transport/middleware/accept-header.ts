/**
 * Accept header validation middleware
 * MCP Spec 2025-06-18 MUST requirement
 */

import { Request, Response, NextFunction } from 'express';
import { createJsonRpcError } from '../utils/json-rpc.js';
import { logProtocolEvent, sanitizeForLog } from '../utils/logging.js';

/**
 * Validates Accept header
 * For POST: Client must accept application/json or text/event-stream
 * For GET: Client must accept text/event-stream
 */
export function validateAcceptHeader(req: Request, res: Response, next: NextFunction): void {
  const accept = req.headers.accept;

  // For POST requests, allow missing Accept header (SDK compatibility)
  if (req.method === 'POST' && !accept) {
    return next();
  }

  if (!accept) {
    logProtocolEvent('Missing Accept header');
    res.status(400).json(createJsonRpcError(-32600, 'Missing Accept header'));
    return;
  }

  // Allow wildcard or specific types
  const acceptsAll = accept.includes('*/*');
  const hasJson = accept.includes('application/json');
  const hasSSE = accept.includes('text/event-stream');

  // At least one valid content type must be accepted
  if (!hasJson && !hasSSE && !acceptsAll) {
    logProtocolEvent(`Invalid Accept header: ${sanitizeForLog(accept)}`);
    res
      .status(400)
      .json(
        createJsonRpcError(
          -32600, 
          'Accept header must include application/json or text/event-stream'
        ),
      );
    return;
  }

  next();
}
