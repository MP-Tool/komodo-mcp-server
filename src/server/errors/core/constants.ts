/**
 * Constants Module
 *
 * Constants related to validation and data sanitization:
 * - Display limits for error messages
 * - Sensitive field patterns for redaction
 *
 * @module server/errors/core/constants
 */

// ============================================================================
// Validation Display Limits
// ============================================================================

/**
 * Validation limits for error handling.
 *
 * Used to truncate values displayed in error messages
 * to prevent overly long outputs and potential data leaks.
 */
export const VALIDATION_LIMITS = {
  /** Maximum string length to display in error messages */
  MAX_STRING_DISPLAY_LENGTH: 100,
  /** Maximum array items to display in error messages */
  MAX_ARRAY_DISPLAY_ITEMS: 5,
  /** Maximum object keys to display in error messages */
  MAX_OBJECT_DISPLAY_KEYS: 5,
} as const;

// ============================================================================
// Sensitive Field Patterns
// ============================================================================

/**
 * Field names that should be redacted in error messages.
 *
 * These patterns are used to detect sensitive data that
 * should not appear in logs or error responses.
 */
export const SENSITIVE_FIELD_PATTERNS = [
  /password/i,
  /secret/i,
  /key/i,
  /token/i,
  /jwt/i,
  /bearer/i,
  /auth/i,
  /credential/i,
  /api[_-]?key/i,
] as const;

/**
 * Check if a field name is sensitive and should be redacted.
 *
 * @param fieldName - The field name to check
 * @returns True if the field is sensitive
 */
export function isSensitiveField(fieldName: string): boolean {
  return SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(fieldName));
}

/**
 * Redaction placeholder for sensitive values.
 */
export const REDACTED_VALUE = '[REDACTED]' as const;

/**
 * Redact a value if the field name is sensitive.
 *
 * @param fieldName - The field name
 * @param value - The value to potentially redact
 * @returns The original value or '[REDACTED]'
 */
export function redactIfSensitive(fieldName: string, value: unknown): unknown {
  return isSensitiveField(fieldName) ? REDACTED_VALUE : value;
}
