/**
 * Validation Error Classes
 *
 * Errors related to input validation and configuration.
 *
 * @module errors/validation
 */

import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { ZodError } from 'zod';
import { KomodoError, KomodoErrorCode } from './base.js';

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
 * ```
 */
export class ValidationError extends KomodoError {
  /** The field that failed validation */
  readonly field?: string;

  /** The invalid value (sanitized) */
  readonly value?: unknown;

  /** All validation issues (for multi-field validation) */
  readonly issues?: ValidationIssue[];

  constructor(
    message: string,
    options: {
      field?: string;
      value?: unknown;
      issues?: ValidationIssue[];
      cause?: Error;
      context?: Record<string, unknown>;
    } = {},
  ) {
    super(message, {
      code: KomodoErrorCode.VALIDATION_ERROR,
      statusCode: 400,
      mcpCode: ErrorCode.InvalidParams,
      cause: options.cause,
      context: {
        ...options.context,
        field: options.field,
        // Don't include actual value in context to avoid sensitive data leaks
        hasValue: options.value !== undefined,
      },
    });

    this.field = options.field;
    // Sanitize the value - don't store sensitive information
    this.value = this.sanitizeValue(options.value);
    this.issues = options.issues;
  }

  /**
   * Sanitize a value for safe storage/logging.
   * Removes potential sensitive data.
   */
  private sanitizeValue(value: unknown): unknown {
    if (value === undefined || value === null) {
      return value;
    }

    // For strings, truncate and indicate type
    if (typeof value === 'string') {
      if (value.length > 50) {
        return `[string:${value.length} chars]`;
      }
      // Check for potential secrets
      if (/password|secret|key|token|jwt|bearer/i.test(String(this.field))) {
        return '[REDACTED]';
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
    const errorMessage = message || primaryIssue?.message || 'Validation failed';

    return new ValidationError(errorMessage, {
      field: primaryIssue?.path,
      issues,
      cause: zodError,
    });
  }

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

/**
 * A single validation issue.
 */
export interface ValidationIssue {
  /** Path to the invalid field (e.g., 'config.port') */
  path: string;
  /** Human-readable error message */
  message: string;
  /** Zod error code */
  code: string;
}

/**
 * Error thrown when configuration is invalid.
 *
 * @example
 * ```typescript
 * throw new ConfigurationError('Missing required environment variable: KOMODO_URL');
 * ```
 */
export class ConfigurationError extends KomodoError {
  /** The configuration key that is invalid */
  readonly configKey?: string;

  constructor(
    message: string,
    options: {
      configKey?: string;
      cause?: Error;
      context?: Record<string, unknown>;
    } = {},
  ) {
    super(message, {
      code: KomodoErrorCode.CONFIGURATION_ERROR,
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

  /**
   * Create a ConfigurationError for a missing environment variable.
   */
  static missingEnvVar(varName: string): ConfigurationError {
    return new ConfigurationError(`Missing required environment variable: ${varName}`, {
      configKey: varName,
    });
  }

  /**
   * Create a ConfigurationError for an invalid environment variable value.
   */
  static invalidEnvVar(varName: string, reason: string): ConfigurationError {
    return new ConfigurationError(`Invalid value for environment variable ${varName}: ${reason}`, {
      configKey: varName,
    });
  }
}
