/**
 * Formatting utilities for consistent output across the application.
 *
 * @module utils/format
 */

/**
 * Length of truncated session ID for logging (first 8 characters).
 * Provides enough entropy for debugging while keeping logs readable.
 */
const SESSION_ID_LOG_LENGTH = 8;

/**
 * Formats a session ID for logging purposes.
 *
 * Truncates the session ID to the first 8 characters to:
 * - Keep logs readable
 * - Provide enough uniqueness for debugging
 * - Avoid exposing full session tokens in logs
 *
 * @param sessionId - The full session ID
 * @returns Truncated session ID (first 8 chars)
 *
 * @example
 * ```typescript
 * formatSessionId('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
 * // Returns: 'a1b2c3d4'
 * ```
 */
export function formatSessionId(sessionId: string): string {
  return sessionId.substring(0, SESSION_ID_LOG_LENGTH);
}
