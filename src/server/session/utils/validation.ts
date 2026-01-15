/**
 * Session Validation Utilities
 *
 * Provides validation functions for session-related operations.
 * Used to ensure session data integrity and security.
 *
 * Note: Session ID validation is delegated to Zod schemas in core/schemas.ts
 * for consistency. This module re-exports and wraps those validators.
 *
 * @module session/utils/validation
 */

import type { SessionData } from '../core/index.js';
import {
  DEFAULT_SESSION_MAX_COUNT,
  validateSessionIdSafe,
  isValidSessionId as isValidSessionIdZod,
} from '../core/index.js';

// ============================================================================
// Session ID Validation
// ============================================================================

/**
 * Validates a session ID format using Zod schema.
 *
 * This function delegates to the Zod-based validation in core/schemas.ts
 * to ensure consistent validation rules across the codebase.
 *
 * @param sessionId - The session ID to validate
 * @returns true if the session ID is valid
 *
 * @example
 * ```typescript
 * isValidSessionId('550e8400-e29b-41d4-a716-446655440000'); // true
 * isValidSessionId('sess_550e8400-e29b-41d4-a716-446655440000'); // true
 * isValidSessionId(''); // false
 * ```
 */
export function isValidSessionId(sessionId: unknown): sessionId is string {
  return isValidSessionIdZod(sessionId);
}

/**
 * Validates a session ID and returns validation result with details.
 *
 * This function wraps the Zod-based validation to provide a consistent
 * interface with detailed error information.
 *
 * @param sessionId - The session ID to validate
 * @returns Validation result object
 */
export function validateSessionId(sessionId: unknown): SessionIdValidationResult {
  // Use Zod-based validation
  const result = validateSessionIdSafe(sessionId);

  if (result.success) {
    return { valid: true };
  }

  // Map Zod errors to our error codes
  const firstError = result.errors[0];
  const code = mapZodErrorToCode(firstError?.code, firstError?.message);

  return {
    valid: false,
    error: firstError?.message ?? 'Invalid session ID',
    code,
  };
}

/**
 * Maps Zod error codes to our SessionIdValidationResult codes.
 */
function mapZodErrorToCode(
  zodCode: string | undefined,
  message: string | undefined,
): SessionIdValidationResult['code'] {
  if (!zodCode) return 'INVALID_CHARACTERS';

  // Map based on Zod error codes and messages
  if (zodCode === 'invalid_type') {
    if (message?.includes('Required')) return 'MISSING_SESSION_ID';
    return 'INVALID_TYPE';
  }
  if (zodCode === 'too_small') return 'TOO_SHORT';
  if (zodCode === 'too_big') return 'TOO_LONG';

  return 'INVALID_CHARACTERS';
}

/**
 * Result of session ID validation.
 */
export interface SessionIdValidationResult {
  /** Whether the session ID is valid */
  valid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Error code for programmatic handling */
  code?: 'MISSING_SESSION_ID' | 'INVALID_TYPE' | 'TOO_SHORT' | 'TOO_LONG' | 'INVALID_CHARACTERS';
}

// ============================================================================
// Session State Validation
// ============================================================================

/**
 * Checks if a session is healthy based on its data.
 *
 * @param session - The session data to check
 * @param maxMissedHeartbeats - Threshold for missed heartbeats
 * @returns true if the session is healthy
 */
export function isSessionHealthy(session: SessionData, maxMissedHeartbeats: number): boolean {
  // Check missed heartbeats threshold
  if (session.missedHeartbeats >= maxMissedHeartbeats) {
    return false;
  }

  // Session is healthy
  return true;
}

/**
 * Checks if a session can be added (capacity check).
 *
 * @param currentCount - Current number of sessions
 * @param maxCount - Maximum allowed sessions
 * @returns true if a new session can be added
 */
export function canAddSession(currentCount: number, maxCount: number = DEFAULT_SESSION_MAX_COUNT): boolean {
  return currentCount < maxCount;
}

/**
 * Calculates the remaining session capacity.
 *
 * @param currentCount - Current number of sessions
 * @param maxCount - Maximum allowed sessions
 * @returns Number of sessions that can still be added
 */
export function getRemainingCapacity(currentCount: number, maxCount: number = DEFAULT_SESSION_MAX_COUNT): number {
  return Math.max(0, maxCount - currentCount);
}
