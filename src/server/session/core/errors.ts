/**
 * Session Errors Module
 *
 * Specialized error classes for session management operations.
 * All errors extend SessionError which integrates with the framework error system.
 *
 * ## Error Hierarchy
 *
 * ```
 * AppError (framework)
 * └── SessionError (base - see ./base.ts)
 *     ├── SessionLimitError     - Max sessions reached
 *     ├── SessionNotFoundError  - Session ID not found
 *     ├── SessionExpiredError   - Session has expired
 *     ├── SessionInvalidError   - Invalid session data/config
 *     └── SessionManagerShutdownError - Manager is shut down
 * ```
 *
 * @module session/core/errors
 */

import { SessionError, SessionErrorCodes, type SessionErrorOptions } from './base.js';

// ============================================================================
// Re-exports from base module
// ============================================================================

export { SessionError, SessionErrorCodes, getMcpCodeForSessionError } from './base.js';
export type { SessionErrorCode, SessionErrorOptions } from './base.js';

// ============================================================================
// Session Limit Error
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
    super(
      `Session limit reached: ${currentSessions}/${maxSessions} sessions active`,
      SessionErrorCodes.SESSION_LIMIT_REACHED,
      {
        ...options,
        context: {
          ...options?.context,
          maxSessions,
          currentSessions,
        },
        recoveryHint:
          options?.recoveryHint ?? 'Wait for existing sessions to expire or close, or increase the session limit.',
      },
    );
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
    Object.defineProperty(error, 'message', { value: message });
    return error;
  }
}

// ============================================================================
// Session Not Found Error
// ============================================================================

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
    super(`Session not found: ${sessionId}`, SessionErrorCodes.SESSION_NOT_FOUND, {
      ...options,
      sessionId,
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

// ============================================================================
// Session Expired Error
// ============================================================================

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

    super(
      `Session expired: ${sessionId} (inactive for ${elapsedMinutes}min, timeout: ${timeoutMinutes}min)`,
      SessionErrorCodes.SESSION_EXPIRED,
      {
        ...options,
        sessionId,
        context: {
          ...options?.context,
          lastActivity: lastActivity.toISOString(),
          timeoutMs,
          elapsedMs,
        },
        recoveryHint:
          options?.recoveryHint ??
          'The session has expired due to inactivity. Please reconnect to establish a new session.',
      },
    );
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

// ============================================================================
// Session Invalid Error
// ============================================================================

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
  readonly invalidValue?: unknown;

  constructor(message: string, options?: SessionErrorOptions & { field?: string; value?: unknown }) {
    super(message, SessionErrorCodes.SESSION_INVALID, {
      ...options,
      context: {
        ...options?.context,
        field: options?.field,
        value: options?.value,
      },
      recoveryHint: options?.recoveryHint ?? 'Check the session configuration and ensure all values are valid.',
    });
    this.name = 'SessionInvalidError';
    this.field = options?.field;
    this.invalidValue = options?.value;
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

// ============================================================================
// Session Manager Shutdown Error
// ============================================================================

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
    super(`Cannot perform '${operation}': session manager is shut down`, SessionErrorCodes.SESSION_MANAGER_SHUTDOWN, {
      ...options,
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
