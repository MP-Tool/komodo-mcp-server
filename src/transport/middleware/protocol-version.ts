/**
 * MCP Protocol Version validation middleware
 * MCP Spec 2025-06-18 MUST requirement
 */

import { Request, Response, NextFunction } from 'express';
import { createJsonRpcError } from '../utils/json-rpc.js';
import { logProtocolEvent, sanitizeForLog } from '../utils/logging.js';
import { SUPPORTED_PROTOCOL_VERSIONS, FALLBACK_PROTOCOL_VERSION } from '../config/transport.config.js';

/**
 * Validates MCP-Protocol-Version header
 * Server MUST respond with 400 Bad Request if version is invalid/unsupported
 */
export function validateProtocolVersion(req: Request, res: Response, next: NextFunction): void {
  const protocolVersion = req.headers['mcp-protocol-version'] as string | undefined;

  if (!protocolVersion) {
    // Spec: For backwards compatibility, assume fallback version if no header present
    logProtocolEvent(
      `No MCP-Protocol-Version header, assuming ${FALLBACK_PROTOCOL_VERSION} for backwards compatibility`,
    );
    req.headers['mcp-protocol-version'] = FALLBACK_PROTOCOL_VERSION;
    next();
    return;
  }

  if (!SUPPORTED_PROTOCOL_VERSIONS.includes(protocolVersion as (typeof SUPPORTED_PROTOCOL_VERSIONS)[number])) {
    logProtocolEvent(`Unsupported protocol version: ${sanitizeForLog(protocolVersion)}`);
    res
      .status(400)
      .json(
        createJsonRpcError(
          -32600,
          `Unsupported MCP-Protocol-Version: ${protocolVersion}. Supported versions: ${SUPPORTED_PROTOCOL_VERSIONS.join(', ')}`,
        ),
      );
    return;
  }

  next();
}
