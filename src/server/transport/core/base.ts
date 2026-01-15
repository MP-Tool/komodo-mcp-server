/**
 * Transport Error Base Classes
 *
 * Provides transport-specific error handling that extends the framework's AppError.
 * Follows the same pattern as session/core/base.ts and connection/core/base.ts.
 *
 * @module server/transport/core/base
 */

import { ErrorCode as McpErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { AppError, HttpStatus } from '../../errors/index.js';
import type { BaseErrorOptions } from '../../errors/core/types.js';

// ============================================================================
// Transport Error Codes
// ============================================================================

/**
 * Transport-specific error codes.
 *
 * These codes are local to the transport module and extend the framework's
 * error system without polluting global error definitions.
 */
export const TransportErrorCodes = {
  /** Invalid transport configuration */
  INVALID_CONFIG: 'TRANSPORT_INVALID_CONFIG',
  /** Transport initialization failed */
  INIT_FAILED: 'TRANSPORT_INIT_FAILED',
  /** Session not found */
  SESSION_NOT_FOUND: 'TRANSPORT_SESSION_NOT_FOUND',
  /** Session expired */
  SESSION_EXPIRED: 'TRANSPORT_SESSION_EXPIRED',
  /** Invalid request format */
  INVALID_REQUEST: 'TRANSPORT_INVALID_REQUEST',
  /** Invalid content type */
  INVALID_CONTENT_TYPE: 'TRANSPORT_INVALID_CONTENT_TYPE',
  /** Invalid accept header */
  INVALID_ACCEPT_HEADER: 'TRANSPORT_INVALID_ACCEPT_HEADER',
  /** DNS rebinding attack detected */
  DNS_REBINDING: 'TRANSPORT_DNS_REBINDING',
  /** Rate limit exceeded */
  RATE_LIMITED: 'TRANSPORT_RATE_LIMITED',
  /** Invalid protocol version */
  INVALID_PROTOCOL_VERSION: 'TRANSPORT_INVALID_PROTOCOL_VERSION',
  /** SSE connection failed */
  SSE_CONNECTION_FAILED: 'TRANSPORT_SSE_CONNECTION_FAILED',
  /** HTTP server error */
  SERVER_ERROR: 'TRANSPORT_SERVER_ERROR',
} as const;

export type TransportErrorCode = (typeof TransportErrorCodes)[keyof typeof TransportErrorCodes];

// ============================================================================
// Error Code Mappings
// ============================================================================

/**
 * Maps transport error codes to MCP error codes.
 */
const transportErrorToMcpCode: Record<TransportErrorCode, McpErrorCode> = {
  [TransportErrorCodes.INVALID_CONFIG]: McpErrorCode.InvalidParams,
  [TransportErrorCodes.INIT_FAILED]: McpErrorCode.InternalError,
  [TransportErrorCodes.SESSION_NOT_FOUND]: McpErrorCode.InvalidParams,
  [TransportErrorCodes.SESSION_EXPIRED]: McpErrorCode.InvalidParams,
  [TransportErrorCodes.INVALID_REQUEST]: McpErrorCode.InvalidRequest,
  [TransportErrorCodes.INVALID_CONTENT_TYPE]: McpErrorCode.InvalidRequest,
  [TransportErrorCodes.INVALID_ACCEPT_HEADER]: McpErrorCode.InvalidRequest,
  [TransportErrorCodes.DNS_REBINDING]: McpErrorCode.InvalidRequest,
  [TransportErrorCodes.RATE_LIMITED]: McpErrorCode.InvalidRequest,
  [TransportErrorCodes.INVALID_PROTOCOL_VERSION]: McpErrorCode.InvalidRequest,
  [TransportErrorCodes.SSE_CONNECTION_FAILED]: McpErrorCode.InternalError,
  [TransportErrorCodes.SERVER_ERROR]: McpErrorCode.InternalError,
};

/**
 * Maps transport error codes to HTTP status codes.
 */
const transportErrorToHttpStatus: Record<TransportErrorCode, number> = {
  [TransportErrorCodes.INVALID_CONFIG]: HttpStatus.BAD_REQUEST,
  [TransportErrorCodes.INIT_FAILED]: HttpStatus.INTERNAL_SERVER_ERROR,
  [TransportErrorCodes.SESSION_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [TransportErrorCodes.SESSION_EXPIRED]: HttpStatus.UNAUTHORIZED,
  [TransportErrorCodes.INVALID_REQUEST]: HttpStatus.BAD_REQUEST,
  [TransportErrorCodes.INVALID_CONTENT_TYPE]: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  [TransportErrorCodes.INVALID_ACCEPT_HEADER]: HttpStatus.BAD_REQUEST,
  [TransportErrorCodes.DNS_REBINDING]: HttpStatus.FORBIDDEN,
  [TransportErrorCodes.RATE_LIMITED]: HttpStatus.TOO_MANY_REQUESTS,
  [TransportErrorCodes.INVALID_PROTOCOL_VERSION]: HttpStatus.BAD_REQUEST,
  [TransportErrorCodes.SSE_CONNECTION_FAILED]: HttpStatus.INTERNAL_SERVER_ERROR,
  [TransportErrorCodes.SERVER_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Gets the MCP error code for a transport error code.
 */
export function getMcpCodeForTransportError(code: TransportErrorCode): McpErrorCode {
  return transportErrorToMcpCode[code] ?? McpErrorCode.InternalError;
}

/**
 * Gets the HTTP status code for a transport error code.
 */
export function getHttpStatusForTransportError(code: TransportErrorCode): number {
  return transportErrorToHttpStatus[code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
}

// ============================================================================
// Transport Error Base Class
// ============================================================================

/**
 * Options for creating a TransportError.
 */
export interface TransportErrorOptions extends Omit<BaseErrorOptions, 'code'> {
  /** Transport-specific error code */
  code: TransportErrorCode;
}

/**
 * Base error class for all transport-related errors.
 *
 * Extends AppError with transport-specific error codes and mappings.
 * Use this as the base class for specialized transport errors.
 *
 * @example
 * ```typescript
 * throw new TransportError('Invalid Content-Type header', {
 *   code: TransportErrorCodes.INVALID_CONTENT_TYPE,
 *   context: { received: 'text/plain', expected: 'application/json' }
 * });
 * ```
 */
export class TransportError extends AppError {
  constructor(message: string, options: TransportErrorOptions) {
    const mcpCode = getMcpCodeForTransportError(options.code);
    const statusCode = getHttpStatusForTransportError(options.code);

    super(message, {
      ...options,
      mcpCode,
      statusCode,
    });
  }

  /**
   * Type guard for transport error code.
   */
  isTransportError(): this is TransportError {
    return Object.values(TransportErrorCodes).includes(this.code as TransportErrorCode);
  }
}
