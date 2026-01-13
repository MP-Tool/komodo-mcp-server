/**
 * Session Errors Module
 *
 * Custom error classes for session management operations.
 * These errors provide specific context and recovery hints for
 * session-related failures.
 *
 * ## Error Hierarchy
 *
 * ```
 * SessionError (base)
 * ├── SessionLimitError     - Max sessions reached
 * ├── SessionNotFoundError  - Session ID not found
 * ├── SessionExpiredError   - Session has expired
 * └── SessionInvalidError   - Invalid session data/config
 * ```
 *
 * @module session/core/errors
 */

import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Session-specific error codes.
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
// Error Options
// ============================================================================

/**
 * Options for creating session errors.
 */
export interface SessionErrorOptions {
  /** Session ID related to the error */
  sessionId?: string;
  /** Additional context for debugging */
  context?: Record<string, unknown>;
  /** Original error that caused this error */
  cause?: Error;
  /** Recovery hint for users */
  recoveryHint?: string;
}

// ============================================================================
// Base Session Error
// ============================================================================

/**
 * Base error class for all session-related errors.
 *
 * Provides consistent error handling with:
 * - Session-specific error codes
 * - MCP error code mapping
 * - Recovery hints
 * - Context information
 *
 * @example
 * ```typescript
 * throw new SessionError('Session operation failed', {
 *   code: SessionErrorCodes.SESSION_INVALID,
 *   sessionId: 'abc-123',
 *   context: { operation: 'heartbeat' }
 * });
 * ```
 */
export class SessionError extends Error {
  /** Session-specific error code */
  readonly code: SessionErrorCode;

  /** MCP error code for JSON-RPC responses */
  readonly mcpCode: ErrorCode;

  /** Session ID related to this error */
  readonly sessionId?: string;

  /** Additional context for debugging */
  readonly context?: Record<string, unknown>;

  /** Original error that caused this error */
  override readonly cause?: Error;

  /** Timestamp when the error occurred */
  readonly timestamp: Date;

  /** Recovery hint for users */
  readonly recoveryHint?: string;

  constructor(
    message: string,
    options: SessionErrorOptions & { code: SessionErrorCode } = {
      code: SessionErrorCodes.SESSION_INVALID,
    },
  ) {
    super(message);
    this.name = 'SessionError';
    this.code = options.code;
    this.mcpCode = this.mapToMcpCode(options.code);
    this.sessionId = options.sessionId;
    this.context = options.context;
    this.cause = options.cause;
    this.timestamp = new Date();
    this.recoveryHint = options.recoveryHint;

    // Maintain proper stack trace in V8 environments
    /* v8 ignore start - V8-specific runtime feature */
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
    /* v8 ignore stop */
  }

  /**
   * Maps session error codes to MCP error codes.
   */
  private mapToMcpCode(code: SessionErrorCode): ErrorCode {
    switch (code) {
      case SessionErrorCodes.SESSION_LIMIT_REACHED:
        return ErrorCode.InvalidRequest;
      case SessionErrorCodes.SESSION_NOT_FOUND:
        return ErrorCode.InvalidParams;
      case SessionErrorCodes.SESSION_EXPIRED:
        return ErrorCode.InvalidParams;
      case SessionErrorCodes.SESSION_INVALID:
        return ErrorCode.InvalidParams;
      case SessionErrorCodes.SESSION_MANAGER_SHUTDOWN:
        return ErrorCode.InternalError;
      case SessionErrorCodes.SESSION_HEARTBEAT_FAILED:
        return ErrorCode.InternalError;
      default:
        return ErrorCode.InternalError;
    }
  }

  /**
   * Serializes the error for logging or API response.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      mcpCode: this.mcpCode,
      sessionId: this.sessionId,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      recoveryHint: this.recoveryHint,
      stack: process.env.NODE_ENV !== 'production' ? this.stack : undefined,
    };
  }
}

// ============================================================================
// Specific Session Errors
// ============================================================================

/**
 * Error thrown when the maximum session limit has been reached.
 *
 * @example
 * ```typescript
 * if (sessions.size >= maxCount) {
 *   throw new SessionLimitError(maxCount, sessions.size);
 * }
 * ```
 */
export class SessionLimitError extends SessionError {
  /** Maximum allowed sessions */
  readonly maxSessions: number;

  /** Current number of active sessions */
  readonly currentSessions: number;

  constructor(maxSessions: number, currentSessions: number, options?: SessionErrorOptions) {
    super(`Session limit reached: ${currentSessions}/${maxSessions} sessions active`, {
      ...options,
      code: SessionErrorCodes.SESSION_LIMIT_REACHED,
      context: {
        ...options?.context,
        maxSessions,
        currentSessions,
      },
      recoveryHint:
        options?.recoveryHint ?? 'Wait for existing sessions to expire or close, or increase the session limit.',
    });
    this.name = 'SessionLimitError';
    this.maxSessions = maxSessions;
    this.currentSessions = currentSessions;
  }

  /**
   * Creates a SessionLimitError with a custom message.
   */
  static withMessage(
    message: string,
    maxSessions: number,
    currentSessions: number,
    options?: SessionErrorOptions,
  ): SessionLimitError {
    const error = new SessionLimitError(maxSessions, currentSessions, options);
    // Override the message
    Object.defineProperty(error, 'message', { value: message });
    return error;
  }
}

/**
 * Error thrown when a session is not found.
 *
 * @example
 * ```typescript
 * const session = sessions.get(sessionId);
 * if (!session) {
 *   throw new SessionNotFoundError(sessionId);
 * }
 * ```
 */
export class SessionNotFoundError extends SessionError {
  constructor(sessionId: string, options?: Omit<SessionErrorOptions, 'sessionId'>) {
    super(`Session not found: ${sessionId}`, {
      ...options,
      sessionId,
      code: SessionErrorCodes.SESSION_NOT_FOUND,
      recoveryHint:
        options?.recoveryHint ??
        'The session may have expired or been removed. Please reconnect to establish a new session.',
    });
    this.name = 'SessionNotFoundError';
  }

  /**
   * Creates a SessionNotFoundError with a truncated session ID for display.
   */
  static withTruncatedId(
    sessionId: string,
    displayLength: number = 8,
    options?: Omit<SessionErrorOptions, 'sessionId'>,
  ): SessionNotFoundError {
    const truncatedId = sessionId.slice(0, displayLength);
    return new SessionNotFoundError(sessionId, {
      ...options,
      context: {
        ...options?.context,
        displayId: truncatedId,
      },
    });
  }
}

/**
 * Error thrown when a session has expired.
 *
 * @example
 * ```typescript
 * if (session.lastActivity < expirationTime) {
 *   throw new SessionExpiredError(sessionId, session.lastActivity, timeoutMs);
 * }
 * ```
 */
export class SessionExpiredError extends SessionError {
  /** Timestamp of last activity */
  readonly lastActivity: Date;

  /** Session timeout in milliseconds */
  readonly timeoutMs: number;

  /** Time elapsed since last activity in milliseconds */
  readonly elapsedMs: number;

  constructor(
    sessionId: string,
    lastActivity: Date,
    timeoutMs: number,
    options?: Omit<SessionErrorOptions, 'sessionId'>,
  ) {
    const elapsedMs = Date.now() - lastActivity.getTime();
    const elapsedMinutes = Math.round(elapsedMs / 60000);
    const timeoutMinutes = Math.round(timeoutMs / 60000);

    super(`Session expired: ${sessionId} (inactive for ${elapsedMinutes}min, timeout: ${timeoutMinutes}min)`, {
      ...options,
      sessionId,
      code: SessionErrorCodes.SESSION_EXPIRED,
      context: {
        ...options?.context,
        lastActivity: lastActivity.toISOString(),
        timeoutMs,
        elapsedMs,
      },
      recoveryHint:
        options?.recoveryHint ??
        'The session has expired due to inactivity. Please reconnect to establish a new session.',
    });
    this.name = 'SessionExpiredError';
    this.lastActivity = lastActivity;
    this.timeoutMs = timeoutMs;
    this.elapsedMs = elapsedMs;
  }

  /**
   * Creates a SessionExpiredError due to missed heartbeats.
   */
  static fromMissedHeartbeats(
    sessionId: string,
    missedCount: number,
    maxMissed: number,
    lastActivity: Date,
    timeoutMs: number,
    options?: Omit<SessionErrorOptions, 'sessionId'>,
  ): SessionExpiredError {
    return new SessionExpiredError(sessionId, lastActivity, timeoutMs, {
      ...options,
      context: {
        ...options?.context,
        reason: 'missed_heartbeats',
        missedCount,
        maxMissed,
      },
      recoveryHint:
        'The session was closed due to missed heartbeats. This may indicate network issues. Please reconnect.',
    });
  }
}

/**
 * Error thrown when session data or configuration is invalid.
 *
 * @example
 * ```typescript
 * if (timeoutMs < 0) {
 *   throw new SessionInvalidError('timeoutMs must be positive', {
 *     context: { field: 'timeoutMs', value: timeoutMs }
 *   });
 * }
 * ```
 */
export class SessionInvalidError extends SessionError {
  /** Field that is invalid (if applicable) */
  readonly field?: string;

  /** Invalid value (if applicable) */
  readonly value?: unknown;

  constructor(message: string, options?: SessionErrorOptions & { field?: string; value?: unknown }) {
    super(message, {
      ...options,
      code: SessionErrorCodes.SESSION_INVALID,
      context: {
        ...options?.context,
        field: options?.field,
        value: options?.value,
      },
      recoveryHint: options?.recoveryHint ?? 'Check the session configuration and ensure all values are valid.',
    });
    this.name = 'SessionInvalidError';
    this.field = options?.field;
    this.value = options?.value;
  }

  /**
   * Creates a SessionInvalidError for a required field.
   */
  static fieldRequired(field: string, options?: SessionErrorOptions): SessionInvalidError {
    return new SessionInvalidError(`Session configuration field '${field}' is required`, {
      ...options,
      field,
      recoveryHint: `Provide a valid value for the '${field}' configuration option.`,
    });
  }

  /**
   * Creates a SessionInvalidError for an invalid value range.
   */
  static invalidRange(
    field: string,
    value: number,
    min: number,
    max: number,
    options?: SessionErrorOptions,
  ): SessionInvalidError {
    return new SessionInvalidError(`Session configuration '${field}' must be between ${min} and ${max}, got ${value}`, {
      ...options,
      field,
      value,
      context: {
        ...options?.context,
        min,
        max,
      },
      recoveryHint: `Set '${field}' to a value between ${min} and ${max}.`,
    });
  }

  /**
   * Creates a SessionInvalidError for an invalid type.
   */
  static invalidType(
    field: string,
    expectedType: string,
    actualType: string,
    options?: SessionErrorOptions,
  ): SessionInvalidError {
    return new SessionInvalidError(`Session configuration '${field}' must be ${expectedType}, got ${actualType}`, {
      ...options,
      field,
      context: {
        ...options?.context,
        expectedType,
        actualType,
      },
      recoveryHint: `Ensure '${field}' is of type ${expectedType}.`,
    });
  }
}

/**
 * Error thrown when the session manager has been shut down.
 *
 * @example
 * ```typescript
 * if (this.isShutdown) {
 *   throw new SessionManagerShutdownError('add');
 * }
 * ```
 */
export class SessionManagerShutdownError extends SessionError {
  /** Operation that was attempted */
  readonly operation: string;

  constructor(operation: string, options?: SessionErrorOptions) {
    super(`Cannot perform '${operation}': session manager is shut down`, {
      ...options,
      code: SessionErrorCodes.SESSION_MANAGER_SHUTDOWN,
      context: {
        ...options?.context,
        operation,
      },
      recoveryHint:
        options?.recoveryHint ??
        'The session manager has been shut down. Restart the server to accept new connections.',
    });
    this.name = 'SessionManagerShutdownError';
    this.operation = operation;
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if an error is a SessionError.
 */
export function isSessionError(error: unknown): error is SessionError {
  return error instanceof SessionError;
}

/**
 * Type guard to check if an error is a SessionLimitError.
 */
export function isSessionLimitError(error: unknown): error is SessionLimitError {
  return error instanceof SessionLimitError;
}

/**
 * Type guard to check if an error is a SessionNotFoundError.
 */
export function isSessionNotFoundError(error: unknown): error is SessionNotFoundError {
  return error instanceof SessionNotFoundError;
}

/**
 * Type guard to check if an error is a SessionExpiredError.
 */
export function isSessionExpiredError(error: unknown): error is SessionExpiredError {
  return error instanceof SessionExpiredError;
}

/**
 * Type guard to check if an error is a SessionInvalidError.
 */
export function isSessionInvalidError(error: unknown): error is SessionInvalidError {
  return error instanceof SessionInvalidError;
}

/**
 * Type guard to check if an error is a SessionManagerShutdownError.
 */
export function isSessionManagerShutdownError(error: unknown): error is SessionManagerShutdownError {
  return error instanceof SessionManagerShutdownError;
}
