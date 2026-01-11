/**
 * Logger Formatting Utilities
 *
 * Provides formatting functions for log output, such as truncating
 * session IDs for readability and security.
 *
 * @module logger/core/format
 */

import { ID_DISPLAY_LENGTH } from './constants.js';

/**
 * Formats a session ID for logging purposes.
 *
 * Truncates the session ID to keep logs readable while providing
 * enough uniqueness for debugging. Also avoids exposing full
 * session tokens in logs for security.
 *
 * @param sessionId - The full session ID
 * @returns Truncated session ID (first 8 chars by default)
 *
 * @example
 * ```typescript
 * formatSessionId('a1b2c3d4-e5f6-7890-abcd-ef1234567890')
 * // Returns: 'a1b2c3d4'
 * ```
 */
export function formatSessionId(sessionId: string): string {
  return sessionId.substring(0, ID_DISPLAY_LENGTH);
}

/**
 * Formats a request ID for logging purposes.
 *
 * @param requestId - The full request ID
 * @returns Truncated request ID
 */
export function formatRequestId(requestId: string): string {
  return requestId.substring(0, ID_DISPLAY_LENGTH);
}

/**
 * Formats a trace ID for logging purposes.
 *
 * @param traceId - The full trace ID
 * @returns Truncated trace ID
 */
export function formatTraceId(traceId: string): string {
  return traceId.substring(0, ID_DISPLAY_LENGTH);
}
