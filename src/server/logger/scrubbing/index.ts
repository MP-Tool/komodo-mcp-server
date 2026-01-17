/**
 * Scrubbing Module
 *
 * Security utilities for log sanitization.
 * Provides secret redaction and injection prevention.
 *
 * Note: Security constants (SENSITIVE_KEYS, REDACTED_VALUE, etc.) should be
 * imported directly from '../core/constants.js' or '../core/index.js'
 *
 * @module logger/scrubbing
 */

// Secret Scrubber
export { SecretScrubber, secretScrubber } from './secret-scrubber.js';

// Injection Guard
export { InjectionGuard, injectionGuard, sanitizeForLogging } from './injection-guard.js';
