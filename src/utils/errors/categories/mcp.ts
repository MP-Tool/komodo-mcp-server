/**
 * MCP Error Classes
 *
 * Errors related to MCP protocol and transport:
 * - McpProtocolError: Protocol violations
 * - SessionError: Session management errors
 * - TransportError: Transport layer errors
 *
 * @module errors/categories/mcp
 */

import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { AppError } from '../core/base.js';
import { ErrorCodes, type BaseErrorOptions } from '../core/types.js';
import { getMessage } from '../core/messages.js';
import { JsonRpcErrorCode, HttpStatus } from '../core/constants.js';

// ============================================================================
// MCP Protocol Error
// ============================================================================

/**
 * Error thrown for MCP protocol violations.
 *
 * @example
 * ```typescript
 * throw McpProtocolError.invalidJson();
 * throw McpProtocolError.invalidJsonRpc();
 * ```
 */
export class McpProtocolError extends AppError {
  /** JSON-RPC error code */
  readonly jsonRpcCode: number;

  constructor(message: string, jsonRpcCode: number, options: Omit<BaseErrorOptions, 'code'> = {}) {
    super(message, {
      code: ErrorCodes.INVALID_REQUEST,
      statusCode: HttpStatus.BAD_REQUEST,
      mcpCode: ErrorCode.InvalidRequest,
      cause: options.cause,
      recoveryHint: options.recoveryHint,
      context: {
        ...options.context,
        jsonRpcCode,
      },
    });

    this.jsonRpcCode = jsonRpcCode;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create an error for invalid JSON.
   */
  static invalidJson(): McpProtocolError {
    return new McpProtocolError(getMessage('MCP_INVALID_JSON'), JsonRpcErrorCode.PARSE_ERROR, {
      recoveryHint: 'Ensure the request body contains valid JSON syntax.',
    });
  }

  /**
   * Create an error for invalid JSON-RPC version.
   */
  static invalidJsonRpc(): McpProtocolError {
    return new McpProtocolError(getMessage('MCP_INVALID_JSONRPC'), JsonRpcErrorCode.INVALID_REQUEST, {
      recoveryHint: 'Ensure the request includes "jsonrpc": "2.0" field.',
    });
  }

  /**
   * Create an error for missing method field.
   */
  static missingMethod(): McpProtocolError {
    return new McpProtocolError(getMessage('MCP_MISSING_METHOD'), JsonRpcErrorCode.INVALID_REQUEST, {
      recoveryHint: 'Include a "method" field in the JSON-RPC request.',
    });
  }

  /**
   * Create an error for invalid batch request.
   */
  static invalidBatch(): McpProtocolError {
    return new McpProtocolError(getMessage('MCP_INVALID_BATCH'), JsonRpcErrorCode.INVALID_REQUEST, {
      recoveryHint: 'Batch requests must be a non-empty JSON array.',
    });
  }

  /**
   * Create an error for invalid content type.
   */
  static invalidContentType(): McpProtocolError {
    return new McpProtocolError(getMessage('MCP_INVALID_CONTENT_TYPE'), JsonRpcErrorCode.INVALID_REQUEST, {
      recoveryHint: 'Set Content-Type header to "application/json".',
    });
  }

  /**
   * Create an error for missing Accept header.
   */
  static missingAccept(): McpProtocolError {
    return new McpProtocolError(getMessage('MCP_MISSING_ACCEPT'), JsonRpcErrorCode.INVALID_REQUEST, {
      recoveryHint: 'Include an Accept header with supported content types.',
    });
  }

  /**
   * Create an error for cancelled request.
   */
  static requestCancelled(): McpProtocolError {
    return new McpProtocolError(getMessage('MCP_REQUEST_CANCELLED'), JsonRpcErrorCode.REQUEST_CANCELLED, {
      recoveryHint: 'The request was cancelled. Retry the operation if needed.',
    });
  }
}

// ============================================================================
// Session Error
// ============================================================================

/**
 * Error thrown for session management issues.
 *
 * @example
 * ```typescript
 * throw SessionError.required();
 * throw SessionError.notFound();
 * ```
 */
export class SessionError extends AppError {
  constructor(message: string, options: Omit<BaseErrorOptions, 'code'> = {}) {
    super(message, {
      code: ErrorCodes.INVALID_REQUEST,
      statusCode: options.statusCode ?? HttpStatus.BAD_REQUEST,
      mcpCode: ErrorCode.InvalidRequest,
      cause: options.cause,
      context: options.context,
      recoveryHint: options.recoveryHint,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create an error for missing session ID.
   */
  static required(): SessionError {
    return new SessionError(getMessage('MCP_SESSION_REQUIRED'), {
      recoveryHint: 'Include the Mcp-Session-Id header in your request.',
    });
  }

  /**
   * Create an error for session not found.
   */
  static notFound(): SessionError {
    return new SessionError(getMessage('MCP_SESSION_NOT_FOUND'), {
      recoveryHint: 'Start a new session by connecting to the SSE endpoint.',
    });
  }

  /**
   * Create an error for expired session.
   */
  static expired(): SessionError {
    return new SessionError(getMessage('MCP_SESSION_EXPIRED'), {
      recoveryHint: 'Your session has expired. Reconnect to establish a new session.',
    });
  }

  /**
   * Create an error for too many sessions.
   */
  static tooMany(): SessionError {
    return new SessionError(getMessage('MCP_TOO_MANY_SESSIONS'), {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      recoveryHint: 'Wait a moment and try again, or close unused sessions.',
    });
  }
}

// ============================================================================
// Transport Error
// ============================================================================

/**
 * Error thrown for transport layer issues.
 *
 * @example
 * ```typescript
 * throw TransportError.closed();
 * throw TransportError.unsupported('websocket');
 * ```
 */
export class TransportError extends AppError {
  constructor(message: string, options: Omit<BaseErrorOptions, 'code'> = {}) {
    super(message, {
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      mcpCode: ErrorCode.InternalError,
      cause: options.cause,
      recoveryHint: options.recoveryHint,
      context: options.context,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create an error for closed transport.
   */
  static closed(): TransportError {
    return new TransportError(getMessage('MCP_TRANSPORT_CLOSED'), {
      recoveryHint: 'The transport connection was closed. Reconnect to continue.',
    });
  }

  /**
   * Create an error for transport not started.
   */
  static notStarted(): TransportError {
    return new TransportError(getMessage('MCP_TRANSPORT_NOT_STARTED'), {
      recoveryHint: 'Ensure the transport is properly started before sending messages.',
    });
  }

  /**
   * Create an error for unsupported transport type.
   */
  static unsupported(transport: string): TransportError {
    return new TransportError(getMessage('UNSUPPORTED_TRANSPORT', { transport }), {
      recoveryHint: 'Use a supported transport type: stdio or http.',
    });
  }
}
