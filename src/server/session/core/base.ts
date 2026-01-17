/**
 * Session Base Error Class Module
 *
 * Provides the SessionError base class that extends AppError with
 * session-specific functionality. All session errors inherit from this class.
 *
 * ## Integration with Framework Error System
 *
 * SessionError extends AppError, inheriting:
 * - Unique error ID for tracking
 * - HTTP status code mapping
 * - MCP error code mapping
 * - Serialization and cause chain support
 *
 * Session-specific additions:
 * - Session ID tracking
 * - Session-specific error codes (defined locally, not in framework)
 *
 * @module session/core/base
 */

import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { AppError, HttpStatus, type BaseErrorOptions } from '../../errors/index.js';

// ============================================================================
// Session Error Codes (Local Definition)
// ============================================================================

/**
 * Session-specific error codes.
 *
 * These are defined locally within the session module, not in the
 * central framework ErrorCodes. This keeps session concerns isolated
 * while still integrating with the framework error system.
 */
export const SessionErrorCodes = {
  /** Session limit has been reached */
  SESSION_LIMIT_REACHED: 'SESSION_LIMIT_REACHED',
  /** Session not found */
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  /** Session has expired */
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  /** Invalid session data or configuration */
  SESSION_INVALID: 'SESSION_INVALID',
  /** Session manager is shut down */
  SESSION_MANAGER_SHUTDOWN: 'SESSION_MANAGER_SHUTDOWN',
  /** Heartbeat failed */
  SESSION_HEARTBEAT_FAILED: 'SESSION_HEARTBEAT_FAILED',
} as const;

export type SessionErrorCode = (typeof SessionErrorCodes)[keyof typeof SessionErrorCodes];

// ============================================================================
// Session Error Options
// ============================================================================

/**
 * Options for creating session errors.
 * Extends BaseErrorOptions with session-specific fields.
 */
export interface SessionErrorOptions extends Omit<BaseErrorOptions, 'code'> {
  /** Session ID related to the error */
  sessionId?: string;
}

// ============================================================================
// Session Error Code Mappings
// ============================================================================

/**
 * Maps session error codes to MCP error codes.
 */
const SESSION_ERROR_TO_MCP_CODE: Record<SessionErrorCode, ErrorCode> = {
  [SessionErrorCodes.SESSION_LIMIT_REACHED]: ErrorCode.InvalidRequest,
  [SessionErrorCodes.SESSION_NOT_FOUND]: ErrorCode.InvalidParams,
  [SessionErrorCodes.SESSION_EXPIRED]: ErrorCode.InvalidParams,
  [SessionErrorCodes.SESSION_INVALID]: ErrorCode.InvalidParams,
  [SessionErrorCodes.SESSION_MANAGER_SHUTDOWN]: ErrorCode.InternalError,
  [SessionErrorCodes.SESSION_HEARTBEAT_FAILED]: ErrorCode.InternalError,
};

/**
 * Maps session error codes to HTTP status codes.
 */
const SESSION_ERROR_TO_HTTP_STATUS: Record<SessionErrorCode, number> = {
  [SessionErrorCodes.SESSION_LIMIT_REACHED]: HttpStatus.TOO_MANY_REQUESTS,
  [SessionErrorCodes.SESSION_NOT_FOUND]: HttpStatus.NOT_FOUND,
  [SessionErrorCodes.SESSION_EXPIRED]: HttpStatus.UNAUTHORIZED,
  [SessionErrorCodes.SESSION_INVALID]: HttpStatus.BAD_REQUEST,
  [SessionErrorCodes.SESSION_MANAGER_SHUTDOWN]: HttpStatus.SERVICE_UNAVAILABLE,
  [SessionErrorCodes.SESSION_HEARTBEAT_FAILED]: HttpStatus.INTERNAL_SERVER_ERROR,
};

/**
 * Get MCP error code for a session error code.
 *
 * @param code - Session error code
 * @returns MCP ErrorCode
 */
export function getMcpCodeForSessionError(code: SessionErrorCode): ErrorCode {
  return SESSION_ERROR_TO_MCP_CODE[code] ?? ErrorCode.InternalError;
}

/**
 * Get HTTP status code for a session error code.
 *
 * @param code - Session error code
 * @returns HTTP status code
 */
export function getHttpStatusForSessionError(code: SessionErrorCode): number {
  return SESSION_ERROR_TO_HTTP_STATUS[code] ?? HttpStatus.INTERNAL_SERVER_ERROR;
}

// ============================================================================
// Base Session Error Class
// ============================================================================

/**
 * Base error class for all session-related errors.
 *
 * Extends AppError to integrate with the framework error system while
 * providing session-specific functionality:
 * - Session ID tracking
 * - Session error code mapping (MCP and HTTP)
 *
 * @example
 * ```typescript
 * throw new SessionError(
 *   'Session operation failed',
 *   SessionErrorCodes.SESSION_INVALID,
 *   {
 *     sessionId: 'abc-123',
 *     context: { operation: 'heartbeat' }
 *   }
 * );
 * ```
 */
export class SessionError extends AppError {
  /** Session ID related to this error */
  readonly sessionId?: string;

  constructor(message: string, code: SessionErrorCode, options: SessionErrorOptions = {}) {
    const mcpCode = getMcpCodeForSessionError(code);
    const statusCode = getHttpStatusForSessionError(code);

    super(message, {
      ...options,
      code,
      mcpCode,
      statusCode,
      context: {
        ...options.context,
        ...(options.sessionId && { sessionId: options.sessionId }),
      },
    });

    this.name = 'SessionError';
    this.sessionId = options.sessionId;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Type Guards
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Type guard to check if an error is a SessionError.
   */
  static isSessionError(error: unknown): error is SessionError {
    return error instanceof SessionError;
  }
}
