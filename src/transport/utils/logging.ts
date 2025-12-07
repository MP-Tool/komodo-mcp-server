import { logger as baseLogger } from '../../utils/logger.js';

const logger = baseLogger.child({ component: 'transport' });

/**
 * Logging utilities for transport layer
 */

/**
 * Sanitizes a string for logging to prevent log injection attacks
 * Replaces newlines and other control characters
 */
export function sanitizeForLog(input: string | undefined | null): string {
  if (!input) return '';
  // Replace newlines and carriage returns with space
  // Also replace other control characters if needed, but newlines are the main vector
  return String(input)
    .replace(/[\n\r]/g, ' ')
    .trim();
}

/**
 * Logs MCP session events
 */
export function logSessionInitialized(sessionId: string): void {
  logger.info('Session initialized: %s', sessionId);
}

export function logSessionClosed(sessionId: string): void {
  logger.info('Session closed: %s', sessionId);
}

/**
 * Logs security events
 */
export function logSecurityEvent(event: string, details?: unknown): void {
  logger.warn('Security: %s', event, details || '');
}

/**
 * Logs MCP protocol events
 */
export function logProtocolEvent(event: string, details?: unknown): void {
  // Use %s to prevent format string injection (CWE-134)
  logger.debug('%s', event, details || '');
}
