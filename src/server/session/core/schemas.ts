/**
 * Session Schemas Module
 *
 * Zod schemas for runtime validation of session configuration and data.
 * Provides type-safe validation with detailed error messages.
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *   SessionConfigSchema,
 *   parseSessionConfig,
 *   validateSessionConfigSafe
 * } from './schemas.js';
 *
 * // Parse and validate (throws on error)
 * const config = parseSessionConfig(rawConfig);
 *
 * // Safe validation (returns result object)
 * const result = validateSessionConfigSafe(rawConfig);
 * if (result.success) {
 *   const config = result.data;
 * } else {
 *   console.error(result.errors);
 * }
 * ```
 *
 * @module session/core/schemas
 */

import { z } from 'zod';
import {
  DEFAULT_SESSION_TIMEOUT_MS,
  DEFAULT_SESSION_CLEANUP_INTERVAL_MS,
  DEFAULT_SESSION_KEEP_ALIVE_INTERVAL_MS,
  DEFAULT_SESSION_MAX_MISSED_HEARTBEATS,
  DEFAULT_SESSION_MAX_COUNT,
} from './constants.js';

// ============================================================================
// Schema Constants
// ============================================================================

/**
 * Validation limits for session configuration.
 */
export const SESSION_CONFIG_LIMITS = {
  /** Minimum session timeout (1 minute) */
  MIN_TIMEOUT_MS: 60_000,
  /** Maximum session timeout (24 hours) */
  MAX_TIMEOUT_MS: 24 * 60 * 60 * 1000,

  /** Minimum cleanup interval (10 seconds) */
  MIN_CLEANUP_INTERVAL_MS: 10_000,
  /** Maximum cleanup interval (1 hour) */
  MAX_CLEANUP_INTERVAL_MS: 60 * 60 * 1000,

  /** Minimum keep-alive interval (5 seconds) */
  MIN_KEEP_ALIVE_INTERVAL_MS: 5_000,
  /** Maximum keep-alive interval (5 minutes) */
  MAX_KEEP_ALIVE_INTERVAL_MS: 5 * 60 * 1000,

  /** Minimum missed heartbeats */
  MIN_MISSED_HEARTBEATS: 1,
  /** Maximum missed heartbeats */
  MAX_MISSED_HEARTBEATS: 100,

  /** Minimum session count */
  MIN_SESSION_COUNT: 1,
  /** Maximum session count */
  MAX_SESSION_COUNT: 10_000,
} as const;

// ============================================================================
// Custom Error Messages
// ============================================================================

/**
 * Custom error messages for session validation.
 */
export const SESSION_VALIDATION_MESSAGES = {
  TIMEOUT_MIN: `Session timeout must be at least ${SESSION_CONFIG_LIMITS.MIN_TIMEOUT_MS}ms (1 minute)`,
  TIMEOUT_MAX: `Session timeout must be at most ${SESSION_CONFIG_LIMITS.MAX_TIMEOUT_MS}ms (24 hours)`,
  TIMEOUT_TYPE: 'Session timeout must be a positive integer',

  CLEANUP_MIN: `Cleanup interval must be at least ${SESSION_CONFIG_LIMITS.MIN_CLEANUP_INTERVAL_MS}ms (10 seconds)`,
  CLEANUP_MAX: `Cleanup interval must be at most ${SESSION_CONFIG_LIMITS.MAX_CLEANUP_INTERVAL_MS}ms (1 hour)`,
  CLEANUP_TYPE: 'Cleanup interval must be a positive integer',

  KEEP_ALIVE_MIN: `Keep-alive interval must be at least ${SESSION_CONFIG_LIMITS.MIN_KEEP_ALIVE_INTERVAL_MS}ms (5 seconds)`,
  KEEP_ALIVE_MAX: `Keep-alive interval must be at most ${SESSION_CONFIG_LIMITS.MAX_KEEP_ALIVE_INTERVAL_MS}ms (5 minutes)`,
  KEEP_ALIVE_TYPE: 'Keep-alive interval must be a positive integer',

  HEARTBEATS_MIN: `Max missed heartbeats must be at least ${SESSION_CONFIG_LIMITS.MIN_MISSED_HEARTBEATS}`,
  HEARTBEATS_MAX: `Max missed heartbeats must be at most ${SESSION_CONFIG_LIMITS.MAX_MISSED_HEARTBEATS}`,
  HEARTBEATS_TYPE: 'Max missed heartbeats must be a positive integer',

  MAX_COUNT_MIN: `Max session count must be at least ${SESSION_CONFIG_LIMITS.MIN_SESSION_COUNT}`,
  MAX_COUNT_MAX: `Max session count must be at most ${SESSION_CONFIG_LIMITS.MAX_SESSION_COUNT}`,
  MAX_COUNT_TYPE: 'Max session count must be a positive integer',
} as const;

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Schema for session timeout configuration (in milliseconds).
 */
export const SessionTimeoutSchema = z
  .number({
    required_error: 'Session timeout is required',
    invalid_type_error: SESSION_VALIDATION_MESSAGES.TIMEOUT_TYPE,
  })
  .int(SESSION_VALIDATION_MESSAGES.TIMEOUT_TYPE)
  .min(SESSION_CONFIG_LIMITS.MIN_TIMEOUT_MS, SESSION_VALIDATION_MESSAGES.TIMEOUT_MIN)
  .max(SESSION_CONFIG_LIMITS.MAX_TIMEOUT_MS, SESSION_VALIDATION_MESSAGES.TIMEOUT_MAX)
  .default(DEFAULT_SESSION_TIMEOUT_MS);

/**
 * Schema for cleanup interval configuration (in milliseconds).
 */
export const SessionCleanupIntervalSchema = z
  .number({
    required_error: 'Cleanup interval is required',
    invalid_type_error: SESSION_VALIDATION_MESSAGES.CLEANUP_TYPE,
  })
  .int(SESSION_VALIDATION_MESSAGES.CLEANUP_TYPE)
  .min(SESSION_CONFIG_LIMITS.MIN_CLEANUP_INTERVAL_MS, SESSION_VALIDATION_MESSAGES.CLEANUP_MIN)
  .max(SESSION_CONFIG_LIMITS.MAX_CLEANUP_INTERVAL_MS, SESSION_VALIDATION_MESSAGES.CLEANUP_MAX)
  .default(DEFAULT_SESSION_CLEANUP_INTERVAL_MS);

/**
 * Schema for keep-alive interval configuration (in milliseconds).
 */
export const SessionKeepAliveIntervalSchema = z
  .number({
    required_error: 'Keep-alive interval is required',
    invalid_type_error: SESSION_VALIDATION_MESSAGES.KEEP_ALIVE_TYPE,
  })
  .int(SESSION_VALIDATION_MESSAGES.KEEP_ALIVE_TYPE)
  .min(SESSION_CONFIG_LIMITS.MIN_KEEP_ALIVE_INTERVAL_MS, SESSION_VALIDATION_MESSAGES.KEEP_ALIVE_MIN)
  .max(SESSION_CONFIG_LIMITS.MAX_KEEP_ALIVE_INTERVAL_MS, SESSION_VALIDATION_MESSAGES.KEEP_ALIVE_MAX)
  .default(DEFAULT_SESSION_KEEP_ALIVE_INTERVAL_MS);

/**
 * Schema for max missed heartbeats configuration.
 */
export const SessionMaxMissedHeartbeatsSchema = z
  .number({
    required_error: 'Max missed heartbeats is required',
    invalid_type_error: SESSION_VALIDATION_MESSAGES.HEARTBEATS_TYPE,
  })
  .int(SESSION_VALIDATION_MESSAGES.HEARTBEATS_TYPE)
  .min(SESSION_CONFIG_LIMITS.MIN_MISSED_HEARTBEATS, SESSION_VALIDATION_MESSAGES.HEARTBEATS_MIN)
  .max(SESSION_CONFIG_LIMITS.MAX_MISSED_HEARTBEATS, SESSION_VALIDATION_MESSAGES.HEARTBEATS_MAX)
  .default(DEFAULT_SESSION_MAX_MISSED_HEARTBEATS);

/**
 * Schema for max session count configuration.
 */
export const SessionMaxCountSchema = z
  .number({
    required_error: 'Max session count is required',
    invalid_type_error: SESSION_VALIDATION_MESSAGES.MAX_COUNT_TYPE,
  })
  .int(SESSION_VALIDATION_MESSAGES.MAX_COUNT_TYPE)
  .min(SESSION_CONFIG_LIMITS.MIN_SESSION_COUNT, SESSION_VALIDATION_MESSAGES.MAX_COUNT_MIN)
  .max(SESSION_CONFIG_LIMITS.MAX_SESSION_COUNT, SESSION_VALIDATION_MESSAGES.MAX_COUNT_MAX)
  .default(DEFAULT_SESSION_MAX_COUNT);

/**
 * Base session configuration object schema (without refinements).
 * Used as the base for both full and partial schemas.
 */
const SessionConfigBaseSchema = z
  .object({
    /** Session timeout in milliseconds */
    timeoutMs: SessionTimeoutSchema.optional(),
    /** Cleanup interval in milliseconds */
    cleanupIntervalMs: SessionCleanupIntervalSchema.optional(),
    /** Keep-alive interval in milliseconds */
    keepAliveIntervalMs: SessionKeepAliveIntervalSchema.optional(),
    /** Maximum missed heartbeats before session is closed */
    maxMissedHeartbeats: SessionMaxMissedHeartbeatsSchema.optional(),
    /** Maximum number of concurrent sessions */
    maxCount: SessionMaxCountSchema.optional(),
  })
  .strict();

/**
 * Cross-field validation refinements for session configuration.
 */
function applySessionConfigRefinements<T extends z.ZodTypeAny>(schema: T) {
  return schema
    .refine(
      (config: z.infer<typeof SessionConfigBaseSchema>) => {
        // Keep-alive interval should be less than timeout
        const timeout = config.timeoutMs ?? DEFAULT_SESSION_TIMEOUT_MS;
        const keepAlive = config.keepAliveIntervalMs ?? DEFAULT_SESSION_KEEP_ALIVE_INTERVAL_MS;
        return keepAlive < timeout;
      },
      {
        message: 'Keep-alive interval must be less than session timeout',
        path: ['keepAliveIntervalMs'],
      },
    )
    .refine(
      (config: z.infer<typeof SessionConfigBaseSchema>) => {
        // Cleanup interval should be reasonable compared to timeout
        const timeout = config.timeoutMs ?? DEFAULT_SESSION_TIMEOUT_MS;
        const cleanup = config.cleanupIntervalMs ?? DEFAULT_SESSION_CLEANUP_INTERVAL_MS;
        return cleanup <= timeout;
      },
      {
        message: 'Cleanup interval should not exceed session timeout',
        path: ['cleanupIntervalMs'],
      },
    );
}

/**
 * Complete session configuration schema.
 *
 * All fields are optional with sensible defaults from environment configuration.
 */
export const SessionConfigSchema = applySessionConfigRefinements(SessionConfigBaseSchema);

/**
 * Partial session configuration schema (for updates).
 * Same as SessionConfigSchema but explicitly for partial updates.
 */
export const PartialSessionConfigSchema = applySessionConfigRefinements(SessionConfigBaseSchema.partial());

/**
 * Session ID schema.
 */
export const SessionIdSchema = z
  .string({
    required_error: 'Session ID is required',
    invalid_type_error: 'Session ID must be a string',
  })
  .min(1, 'Session ID cannot be empty')
  .max(256, 'Session ID is too long (max 256 characters)');

/**
 * Session data schema for validation.
 */
export const SessionDataSchema = z.object({
  /** Transport must be an object (we can't validate Transport interface with Zod) */
  transport: z.object({}).passthrough(),
  /** Last activity timestamp */
  lastActivity: z.date(),
  /** Number of consecutive missed heartbeats */
  missedHeartbeats: z.number().int().min(0),
});

// ============================================================================
// Type Inference
// ============================================================================

/**
 * Inferred type from SessionConfigSchema.
 */
export type ValidatedSessionConfig = z.infer<typeof SessionConfigSchema>;

/**
 * Inferred type from PartialSessionConfigSchema.
 */
export type PartialValidatedSessionConfig = z.infer<typeof PartialSessionConfigSchema>;

/**
 * Inferred type from SessionIdSchema.
 */
export type ValidatedSessionId = z.infer<typeof SessionIdSchema>;

/**
 * Inferred type from SessionDataSchema.
 */
export type ValidatedSessionData = z.infer<typeof SessionDataSchema>;

// ============================================================================
// Validation Result Types
// ============================================================================

/**
 * Validation error detail.
 */
export interface ValidationErrorDetail {
  /** Field path that failed validation */
  path: (string | number)[];
  /** Error message */
  message: string;
  /** Error code */
  code: string;
}

/**
 * Result of a safe validation operation.
 */
export type ValidationResult<T> = { success: true; data: T } | { success: false; errors: ValidationErrorDetail[] };

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Parses and validates session configuration, throwing on error.
 *
 * @param config - Raw configuration to validate
 * @returns Validated configuration
 * @throws ZodError if validation fails
 *
 * @example
 * ```typescript
 * const config = parseSessionConfig({
 *   timeoutMs: 600000,
 *   maxCount: 100
 * });
 * ```
 */
export function parseSessionConfig(config: unknown): ValidatedSessionConfig {
  return SessionConfigSchema.parse(config);
}

/**
 * Safely validates session configuration without throwing.
 *
 * @param config - Raw configuration to validate
 * @returns Validation result with data or errors
 *
 * @example
 * ```typescript
 * const result = validateSessionConfigSafe({ timeoutMs: -1 });
 * if (!result.success) {
 *   console.error('Validation failed:', result.errors);
 * }
 * ```
 */
export function validateSessionConfigSafe(config: unknown): ValidationResult<ValidatedSessionConfig> {
  const result = SessionConfigSchema.safeParse(config);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: ValidationErrorDetail[] = result.error.issues.map((issue) => ({
    path: issue.path,
    message: issue.message,
    code: issue.code,
  }));

  return { success: false, errors };
}

/**
 * Parses and validates a session ID.
 *
 * @param sessionId - Session ID to validate
 * @returns Validated session ID
 * @throws ZodError if validation fails
 */
export function parseSessionId(sessionId: unknown): ValidatedSessionId {
  return SessionIdSchema.parse(sessionId);
}

/**
 * Safely validates a session ID without throwing.
 *
 * @param sessionId - Session ID to validate
 * @returns Validation result with data or errors
 */
export function validateSessionIdSafe(sessionId: unknown): ValidationResult<ValidatedSessionId> {
  const result = SessionIdSchema.safeParse(sessionId);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: ValidationErrorDetail[] = result.error.issues.map((issue) => ({
    path: issue.path,
    message: issue.message,
    code: issue.code,
  }));

  return { success: false, errors };
}

/**
 * Validates partial session configuration (for updates).
 *
 * @param config - Partial configuration to validate
 * @returns Validated partial configuration
 * @throws ZodError if validation fails
 */
export function parsePartialSessionConfig(config: unknown): PartialValidatedSessionConfig {
  return PartialSessionConfigSchema.parse(config);
}

/**
 * Safely validates partial session configuration without throwing.
 *
 * @param config - Partial configuration to validate
 * @returns Validation result with data or errors
 */
export function validatePartialSessionConfigSafe(config: unknown): ValidationResult<PartialValidatedSessionConfig> {
  const result = PartialSessionConfigSchema.safeParse(config);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: ValidationErrorDetail[] = result.error.issues.map((issue: z.ZodIssue) => ({
    path: issue.path,
    message: issue.message,
    code: issue.code,
  }));

  return { success: false, errors };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Checks if a value is a valid session timeout.
 */
export function isValidTimeout(value: unknown): value is number {
  return SessionTimeoutSchema.safeParse(value).success;
}

/**
 * Checks if a value is a valid cleanup interval.
 */
export function isValidCleanupInterval(value: unknown): value is number {
  return SessionCleanupIntervalSchema.safeParse(value).success;
}

/**
 * Checks if a value is a valid keep-alive interval.
 */
export function isValidKeepAliveInterval(value: unknown): value is number {
  return SessionKeepAliveIntervalSchema.safeParse(value).success;
}

/**
 * Checks if a value is a valid max missed heartbeats.
 */
export function isValidMaxMissedHeartbeats(value: unknown): value is number {
  return SessionMaxMissedHeartbeatsSchema.safeParse(value).success;
}

/**
 * Checks if a value is a valid max session count.
 */
export function isValidMaxCount(value: unknown): value is number {
  return SessionMaxCountSchema.safeParse(value).success;
}

/**
 * Checks if a value is a valid session ID.
 */
export function isValidSessionId(value: unknown): value is string {
  return SessionIdSchema.safeParse(value).success;
}

/**
 * Formats validation errors as a human-readable string.
 *
 * @param errors - Array of validation error details
 * @returns Formatted error string
 */
export function formatValidationErrors(errors: ValidationErrorDetail[]): string {
  return errors.map((e) => (e.path.length > 0 ? `${e.path.join('.')}: ${e.message}` : e.message)).join('; ');
}
