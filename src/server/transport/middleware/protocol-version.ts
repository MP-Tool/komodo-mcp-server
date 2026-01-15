/**
 * MCP Protocol Version validation middleware
 * MCP Spec 2025-06-18 MUST requirement
 */

import { Request, Response, NextFunction } from 'express';
import { sanitizeForLog } from '../utils/index.js';
import { SUPPORTED_PROTOCOL_VERSIONS, FALLBACK_PROTOCOL_VERSION } from '../../../config/index.js';
import { logger as baseLogger } from '../../logger/index.js';
import {
  HTTP_STATUS,
  JSON_RPC_ERROR_CODES,
  TRANSPORT_LOG_COMPONENTS,
  formatProtocolVersionError,
} from '../core/index.js';
import { createJsonRpcError } from '../utils/json-rpc.js';

const logger = baseLogger.child({ component: TRANSPORT_LOG_COMPONENTS.MIDDLEWARE });

/**
 * Validates MCP-Protocol-Version header
 * Server MUST respond with 400 Bad Request if version is invalid/unsupported
 */
export function validateProtocolVersion(req: Request, res: Response, next: NextFunction): void {
  const protocolVersion = req.headers['mcp-protocol-version'] as string | undefined;

  if (!protocolVersion) {
    // Spec: For backwards compatibility, assume fallback version if no header present
    req.headers['mcp-protocol-version'] = FALLBACK_PROTOCOL_VERSION;
    next();
    return;
  }

  if (!SUPPORTED_PROTOCOL_VERSIONS.includes(protocolVersion as (typeof SUPPORTED_PROTOCOL_VERSIONS)[number])) {
    logger.warn('Unsupported protocol version: %s', sanitizeForLog(protocolVersion));
    res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json(
        createJsonRpcError(
          JSON_RPC_ERROR_CODES.INVALID_REQUEST,
          formatProtocolVersionError(protocolVersion, SUPPORTED_PROTOCOL_VERSIONS),
        ),
      );
    return;
  }

  next();
}
