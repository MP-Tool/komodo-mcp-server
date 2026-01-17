/**
 * MCP Error Classes
 *
 * Errors related to MCP protocol and transport:
 * - McpProtocolError: Protocol violations
 * - SessionError: Session management errors
 * - TransportError: Transport layer errors
 *
 * @module server/errors/categories/mcp
 */

import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import {
  AppError,
  ErrorCodes,
  HttpStatus,
  JsonRpcErrorCode,
  BaseErrorOptions,
  getFrameworkMessage,
} from '../core/index.js';

// ============================================================================
// MCP Protocol Error
// ============================================================================

/**
 * Error thrown for MCP protocol violations.
 *
 * @example
 * ```typescript
 * throw McpProtocolError.invalidJson();
 * throw McpProtocolError.invalidRequest('Missing required field');
 * ```
 */
export class McpProtocolError extends AppError {
  /** JSON-RPC error code */
  readonly jsonRpcCode: number;

  constructor(message: string, jsonRpcCode?: number, options: Omit<BaseErrorOptions, 'code'> = {}) {
    super(message, {
      code: ErrorCodes.INVALID_REQUEST,
      statusCode: HttpStatus.BAD_REQUEST,
      mcpCode: ErrorCode.InvalidRequest,
      cause: options.cause,
      recoveryHint: options.recoveryHint,
      context: {
        ...options.context,
        jsonRpcCode: jsonRpcCode ?? JsonRpcErrorCode.INVALID_REQUEST,
      },
    });

    this.jsonRpcCode = jsonRpcCode ?? JsonRpcErrorCode.INVALID_REQUEST;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Generic Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a generic invalid request error.
   */
  static invalidRequest(reason: string): McpProtocolError {
    return new McpProtocolError(`Invalid request: ${reason}`, JsonRpcErrorCode.INVALID_REQUEST, {
      recoveryHint: 'Check the request format and required fields.',
    });
  }

  /**
   * Create a method not found error.
   */
  static methodNotFound(method: string): McpProtocolError {
    return new McpProtocolError(`Method not found: ${method}`, JsonRpcErrorCode.METHOD_NOT_FOUND, {
      context: { method },
      recoveryHint: `The method '${method}' does not exist. Check the method name.`,
    });
  }

  /**
   * Create an invalid params error.
   */
  static invalidParams(reason: string): McpProtocolError {
    return new McpProtocolError(`Invalid params: ${reason}`, JsonRpcErrorCode.INVALID_PARAMS, {
      recoveryHint: 'Check the method parameters against the expected schema.',
    });
  }

  /**
   * Create a parse error.
   */
  static parseError(reason: string): McpProtocolError {
    return new McpProtocolError(`Parse error: ${reason}`, JsonRpcErrorCode.PARSE_ERROR, {
      recoveryHint: 'Ensure the request body contains valid JSON syntax.',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Specific Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create an error for invalid JSON.
   */
  static invalidJson(): McpProtocolError {
    return new McpProtocolError(getFrameworkMessage('MCP_INVALID_JSON'), JsonRpcErrorCode.PARSE_ERROR, {
      recoveryHint: 'Ensure the request body contains valid JSON syntax.',
    });
  }

  /**
   * Create an error for invalid JSON-RPC version.
   */
  static invalidJsonRpc(): McpProtocolError {
    return new McpProtocolError(getFrameworkMessage('MCP_INVALID_JSONRPC'), JsonRpcErrorCode.INVALID_REQUEST, {
      recoveryHint: 'Ensure the request includes "jsonrpc": "2.0" field.',
    });
  }

  /**
   * Create an error for missing method field.
   */
  static missingMethod(): McpProtocolError {
    return new McpProtocolError(getFrameworkMessage('MCP_MISSING_METHOD'), JsonRpcErrorCode.INVALID_REQUEST, {
      recoveryHint: 'Include a "method" field in the JSON-RPC request.',
    });
  }

  /**
   * Create an error for invalid batch request.
   */
  static invalidBatch(): McpProtocolError {
    return new McpProtocolError(getFrameworkMessage('MCP_INVALID_BATCH'), JsonRpcErrorCode.INVALID_REQUEST, {
      recoveryHint: 'Batch requests must be a non-empty JSON array.',
    });
  }

  /**
   * Create an error for invalid content type.
   */
  static invalidContentType(): McpProtocolError {
    return new McpProtocolError(getFrameworkMessage('MCP_INVALID_CONTENT_TYPE'), JsonRpcErrorCode.INVALID_REQUEST, {
      recoveryHint: 'Set Content-Type header to "application/json".',
    });
  }

  /**
   * Create an error for missing Accept header.
   */
  static missingAccept(): McpProtocolError {
    return new McpProtocolError(getFrameworkMessage('MCP_MISSING_ACCEPT'), JsonRpcErrorCode.INVALID_REQUEST, {
      recoveryHint: 'Include an Accept header with supported content types.',
    });
  }

  /**
   * Create an error for cancelled request.
   */
  static requestCancelled(): McpProtocolError {
    return new McpProtocolError(getFrameworkMessage('MCP_REQUEST_CANCELLED'), JsonRpcErrorCode.REQUEST_CANCELLED, {
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
 * throw SessionError.sessionNotFound('sess-123');
 * ```
 */
export class SessionError extends AppError {
  /** The session ID if applicable */
  readonly sessionId?: string;

  constructor(message: string, options: Omit<BaseErrorOptions, 'code'> & { sessionId?: string } = {}) {
    super(message, {
      code: ErrorCodes.INVALID_REQUEST,
      statusCode: options.statusCode ?? HttpStatus.BAD_REQUEST,
      mcpCode: ErrorCode.InvalidRequest,
      cause: options.cause,
      context: {
        ...options.context,
        sessionId: options.sessionId,
      },
      recoveryHint: options.recoveryHint,
    });

    this.sessionId = options.sessionId;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create an error for missing session ID.
   */
  static required(): SessionError {
    return new SessionError(getFrameworkMessage('MCP_SESSION_REQUIRED'), {
      recoveryHint: 'Include the Mcp-Session-Id header in your request.',
    });
  }

  /**
   * Create an error for session not found (legacy).
   */
  static notFound(): SessionError {
    return new SessionError(getFrameworkMessage('MCP_SESSION_NOT_FOUND'), {
      recoveryHint: 'Start a new session by connecting to the SSE endpoint.',
    });
  }

  /**
   * Create an error for session not found (with ID).
   */
  static sessionNotFound(sessionId: string): SessionError {
    return new SessionError(getFrameworkMessage('SESSION_NOT_FOUND', { sessionId }), {
      sessionId,
      recoveryHint: 'Start a new session by connecting to the SSE endpoint.',
    });
  }

  /**
   * Create an error for expired session.
   */
  static expired(): SessionError {
    return new SessionError(getFrameworkMessage('MCP_SESSION_EXPIRED'), {
      recoveryHint: 'Your session has expired. Reconnect to establish a new session.',
    });
  }

  /**
   * Create an error for expired session (with ID).
   */
  static sessionExpired(sessionId: string): SessionError {
    return new SessionError(getFrameworkMessage('SESSION_EXPIRED', { sessionId }), {
      sessionId,
      recoveryHint: 'Your session has expired. Reconnect to establish a new session.',
    });
  }

  /**
   * Create an error for too many sessions (legacy).
   */
  static tooMany(): SessionError {
    return new SessionError(getFrameworkMessage('MCP_TOO_MANY_SESSIONS'), {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      recoveryHint: 'Wait a moment and try again, or close unused sessions.',
    });
  }

  /**
   * Create an error for session limit reached.
   */
  static sessionLimitReached(maxSessions: number): SessionError {
    return new SessionError(getFrameworkMessage('SESSION_LIMIT_REACHED', { maxSessions: String(maxSessions) }), {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      context: { maxSessions },
      recoveryHint: 'Wait a moment and try again, or close unused sessions.',
    });
  }

  /**
   * Create an error for invalid session state.
   */
  static invalidState(sessionId: string, currentState: string, expectedState: string): SessionError {
    return new SessionError(getFrameworkMessage('SESSION_INVALID_STATE', { sessionId, currentState, expectedState }), {
      sessionId,
      context: { currentState, expectedState },
      recoveryHint: `Session is in '${currentState}' state but needs to be '${expectedState}'.`,
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
 * throw TransportError.connectionFailed('timeout');
 * ```
 */
export class TransportError extends AppError {
  /** The transport type */
  readonly transportType?: 'http' | 'sse' | 'stdio' | 'streamable-http';

  constructor(
    message: string,
    options: Omit<BaseErrorOptions, 'code'> & { transportType?: 'http' | 'sse' | 'stdio' | 'streamable-http' } = {},
  ) {
    super(message, {
      code: ErrorCodes.SERVICE_UNAVAILABLE,
      statusCode: options.statusCode ?? HttpStatus.SERVICE_UNAVAILABLE,
      mcpCode: ErrorCode.InternalError,
      cause: options.cause,
      recoveryHint: options.recoveryHint,
      context: {
        ...options.context,
        transportType: options.transportType,
      },
    });

    this.transportType = options.transportType;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create an error for closed transport.
   */
  static closed(): TransportError {
    return new TransportError(getFrameworkMessage('MCP_TRANSPORT_CLOSED'), {
      recoveryHint: 'The transport connection was closed. Reconnect to continue.',
    });
  }

  /**
   * Create an error for transport not started.
   */
  static notStarted(): TransportError {
    return new TransportError(getFrameworkMessage('MCP_TRANSPORT_NOT_STARTED'), {
      recoveryHint: 'Ensure the transport is properly started before sending messages.',
    });
  }

  /**
   * Create an error for unsupported transport type.
   */
  static unsupported(transport: string): TransportError {
    return new TransportError(getFrameworkMessage('UNSUPPORTED_TRANSPORT', { transport }), {
      recoveryHint: 'Use a supported transport type: stdio or http.',
    });
  }

  /**
   * Create an error for connection failure.
   */
  static connectionFailed(reason: string): TransportError {
    return new TransportError(getFrameworkMessage('TRANSPORT_CONNECTION_FAILED', { reason }), {
      statusCode: HttpStatus.BAD_GATEWAY,
      recoveryHint: `Connection failed: ${reason}. Check network connectivity and try again.`,
    });
  }

  /**
   * Create an error for connection closed.
   */
  static connectionClosed(reason?: string): TransportError {
    const message = reason
      ? getFrameworkMessage('TRANSPORT_CONNECTION_CLOSED_REASON', { reason })
      : getFrameworkMessage('TRANSPORT_CONNECTION_CLOSED');

    return new TransportError(message, {
      recoveryHint: 'The connection was closed. Reconnect to continue.',
    });
  }

  /**
   * Create an error for invalid header.
   */
  static invalidHeader(header: string, reason: string): TransportError {
    return new TransportError(getFrameworkMessage('TRANSPORT_INVALID_HEADER', { header, reason }), {
      statusCode: HttpStatus.BAD_REQUEST,
      context: { header, reason },
      recoveryHint: `Check the '${header}' header value.`,
    });
  }

  /**
   * Create an error for protocol mismatch.
   */
  static protocolMismatch(expected: string, received: string): TransportError {
    return new TransportError(getFrameworkMessage('TRANSPORT_PROTOCOL_MISMATCH', { expected, received }), {
      statusCode: HttpStatus.BAD_REQUEST,
      context: { expected, received },
      recoveryHint: `Use protocol version '${expected}'.`,
    });
  }

  /**
   * Create an error for rate limiting.
   */
  static rateLimited(retryAfterSeconds?: number): TransportError {
    const message = retryAfterSeconds
      ? getFrameworkMessage('TRANSPORT_RATE_LIMITED_RETRY', { retryAfter: String(retryAfterSeconds) })
      : getFrameworkMessage('TRANSPORT_RATE_LIMITED');

    return new TransportError(message, {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      context: retryAfterSeconds ? { retryAfterSeconds } : undefined,
      recoveryHint: retryAfterSeconds
        ? `Wait ${retryAfterSeconds} seconds before retrying.`
        : 'Wait a moment before retrying.',
    });
  }

  /**
   * Create an error for DNS rebinding attack.
   */
  static dnsRebinding(host: string): TransportError {
    return new TransportError(getFrameworkMessage('TRANSPORT_DNS_REBINDING', { host }), {
      statusCode: HttpStatus.FORBIDDEN,
      context: { host },
      recoveryHint: 'Access denied for security reasons.',
    });
  }
}
