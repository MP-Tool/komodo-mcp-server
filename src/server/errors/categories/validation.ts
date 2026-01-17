/**
 * Validation Error Classes
 *
 * Errors related to input validation and configuration:
 * - ValidationError: Input validation failures
 * - ConfigurationError: Configuration/environment errors
 *
 * @module server/errors/categories/validation
 */

import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ZodError } from 'zod';
import { AppError, ErrorCodes, VALIDATION_LIMITS, isSensitiveField, getFrameworkMessage } from '../core/index.js';
import type { ValidationErrorOptions, ValidationIssue, BaseErrorOptions } from '../core/index.js';

// ============================================================================
// Validation Error
// ============================================================================

/**
 * Error thrown when input validation fails.
 *
 * Integrates with Zod for schema validation errors.
 *
 * @example
 * ```typescript
 * // From Zod error
 * throw ValidationError.fromZodError(zodError, 'Invalid server configuration');
 *
 * // Manual validation
 * throw new ValidationError('Server name is required', {
 *   field: 'server',
 *   value: undefined
 * });
 *
 * // Using factory methods
 * throw ValidationError.fieldRequired('server');
 * ```
 */
export class ValidationError extends AppError {
  /** The field that failed validation */
  readonly field?: string;

  /** The invalid value (sanitized) */
  readonly value?: unknown;

  /** All validation issues (for multi-field validation) */
  readonly issues?: ValidationIssue[];

  constructor(message: string, options: ValidationErrorOptions = {}) {
    super(message, {
      code: ErrorCodes.VALIDATION_ERROR,
      statusCode: 400,
      mcpCode: ErrorCode.InvalidParams,
      cause: options.cause,
      recoveryHint: options.recoveryHint,
      context: {
        ...options.context,
        field: options.field,
        // Don't include actual value in context to avoid sensitive data leaks
        hasValue: options.value !== undefined,
      },
    });

    this.field = options.field;
    // Sanitize the value - don't store sensitive information
    this.value = this.sanitizeValue(options.value, options.field);
    this.issues = options.issues;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Value Sanitization
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Sanitize a value for safe storage/logging.
   * Removes potential sensitive data.
   */
  private sanitizeValue(value: unknown, fieldName?: string): unknown {
    if (value === undefined || value === null) {
      return value;
    }

    // Check for potential secrets based on field name
    if (fieldName && isSensitiveField(fieldName)) {
      return '[REDACTED]';
    }

    // For strings, truncate and indicate type
    if (typeof value === 'string') {
      if (value.length > VALIDATION_LIMITS.MAX_STRING_DISPLAY_LENGTH) {
        return `[string:${value.length} chars]`;
      }
      return value;
    }

    // For objects/arrays, indicate structure only
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return `[array:${value.length} items]`;
      }
      return `[object:${Object.keys(value).length} keys]`;
    }

    return value;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a ValidationError from a Zod error.
   */
  static fromZodError(zodError: ZodError, message?: string): ValidationError {
    const issues: ValidationIssue[] = zodError.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));

    const primaryIssue = issues[0];
    const errorMessage = message || primaryIssue?.message || getFrameworkMessage('VALIDATION_FAILED');

    return new ValidationError(errorMessage, {
      field: primaryIssue?.path,
      issues,
      cause: zodError,
      recoveryHint: 'Check the input parameters against the expected schema.',
    });
  }

  /**
   * Create a ValidationError for a required field.
   */
  static fieldRequired(field: string): ValidationError {
    return new ValidationError(getFrameworkMessage('VALIDATION_FIELD_REQUIRED', { field }), {
      field,
      recoveryHint: `Provide a value for the required field '${field}'.`,
    });
  }

  /**
   * Create a ValidationError for an invalid field value.
   */
  static fieldInvalid(field: string, value?: unknown): ValidationError {
    return new ValidationError(getFrameworkMessage('VALIDATION_FIELD_INVALID', { field }), {
      field,
      value,
      recoveryHint: `Check the value provided for '${field}' and ensure it meets the requirements.`,
    });
  }

  /**
   * Create a ValidationError for a type mismatch.
   */
  static fieldTypeMismatch(field: string, expectedType: string): ValidationError {
    return new ValidationError(getFrameworkMessage('VALIDATION_FIELD_TYPE', { field, expectedType }), {
      field,
      recoveryHint: `Field '${field}' must be of type '${expectedType}'.`,
    });
  }

  /**
   * Create a ValidationError for minimum value constraint.
   */
  static fieldMin(field: string, min: number): ValidationError {
    return new ValidationError(getFrameworkMessage('VALIDATION_FIELD_MIN', { field, min: String(min) }), {
      field,
      recoveryHint: `Provide a value of at least ${min} for '${field}'.`,
    });
  }

  /**
   * Create a ValidationError for maximum value constraint.
   */
  static fieldMax(field: string, max: number): ValidationError {
    return new ValidationError(getFrameworkMessage('VALIDATION_FIELD_MAX', { field, max: String(max) }), {
      field,
      recoveryHint: `Provide a value of at most ${max} for '${field}'.`,
    });
  }

  /**
   * Create a ValidationError for pattern mismatch.
   */
  static fieldPattern(field: string): ValidationError {
    return new ValidationError(getFrameworkMessage('VALIDATION_FIELD_PATTERN', { field }), {
      field,
      recoveryHint: `Ensure '${field}' matches the expected format.`,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Formatting
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Format issues as a human-readable list.
   */
  formatIssues(): string {
    if (!this.issues || this.issues.length === 0) {
      return this.message;
    }

    return this.issues.map((issue) => `  - ${issue.path}: ${issue.message}`).join('\n');
  }
}

// ============================================================================
// Configuration Error
// ============================================================================

/**
 * Error thrown when configuration is invalid.
 *
 * @example
 * ```typescript
 * throw new ConfigurationError('Missing required environment variable: API_URL');
 *
 * // Using factory methods
 * throw ConfigurationError.missingEnvVar('API_URL');
 * throw ConfigurationError.invalidEnvVar('API_PORT', 'must be a number');
 * ```
 */
export class ConfigurationError extends AppError {
  /** The configuration key that is invalid */
  readonly configKey?: string;

  constructor(message: string, options: Omit<BaseErrorOptions, 'code'> & { configKey?: string } = {}) {
    super(message, {
      code: ErrorCodes.CONFIGURATION_ERROR,
      statusCode: 500, // Configuration errors are server-side
      mcpCode: ErrorCode.InternalError,
      cause: options.cause,
      context: {
        ...options.context,
        configKey: options.configKey,
      },
    });

    this.configKey = options.configKey;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a ConfigurationError for a missing environment variable.
   */
  static missingEnvVar(varName: string): ConfigurationError {
    return new ConfigurationError(getFrameworkMessage('CONFIG_MISSING_ENV', { varName }), {
      configKey: varName,
      recoveryHint: `Set the environment variable '${varName}' in your configuration.`,
    });
  }

  /**
   * Create a ConfigurationError for an invalid environment variable value.
   */
  static invalidEnvVar(varName: string, reason: string): ConfigurationError {
    return new ConfigurationError(getFrameworkMessage('CONFIG_INVALID_ENV', { varName, reason }), {
      configKey: varName,
      recoveryHint: `Check the value of '${varName}': ${reason}.`,
    });
  }

  /**
   * Create a ConfigurationError with a custom message.
   */
  static invalid(message: string): ConfigurationError {
    return new ConfigurationError(getFrameworkMessage('CONFIG_INVALID', { message }), {
      recoveryHint: 'Review your configuration settings and correct any issues.',
    });
  }
}
