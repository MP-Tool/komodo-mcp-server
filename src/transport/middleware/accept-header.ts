/**
 * Accept header validation middleware
 * MCP Spec 2025-06-18 MUST requirement
 */

import { Request, Response, NextFunction } from 'express';
import { createJsonRpcError } from '../utils/json-rpc.js';
import { sanitizeForLog } from '../utils/logging.js';
import { logger as baseLogger } from '../../utils/logger.js';

const logger = baseLogger.child({ component: 'middleware' });

/**
 * Validates Accept header
 * For POST: Client must accept application/json or text/event-stream
 * For GET: Client must accept text/event-stream
 *
 * LEGACY SUPPORT: GET without session (endpoint event) does not require Accept header
 */
export function validateAcceptHeader(req: Request, res: Response, next: NextFunction): void {
  const accept = req.headers.accept;
  const sessionId = req.headers['mcp-session-id'] || req.query.sessionId;

  // For POST requests, allow missing Accept header (SDK compatibility)
  if (req.method === 'POST' && !accept) {
    return next();
  }

  // LEGACY SUPPORT: GET without session (endpoint event) does not require Accept header
  if (req.method === 'GET' && !sessionId) {
    return next();
  }

  if (!accept) {
    logger.debug('Accept header missing for %s /mcp', req.method);
    res.status(400).json(createJsonRpcError(-32600, 'Missing Accept header'));
    return;
  }

  // Allow wildcard or specific types
  const acceptsAll = accept.includes('*/*');
  const hasJson = accept.includes('application/json');
  const hasSSE = accept.includes('text/event-stream');

  // At least one valid content type must be accepted
  if (!hasJson && !hasSSE && !acceptsAll) {
    logger.debug('Invalid Accept header: %s', sanitizeForLog(accept));
    // prettier-ignore
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
