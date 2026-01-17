/**
 * Injection Guard Module
 *
 * Provides protection against log injection attacks (CWE-117).
 * Prevents attackers from forging log entries by injecting newlines or control characters.
 *
 * @see https://cwe.mitre.org/data/definitions/117.html
 * @module logger/scrubbing/injection-guard
 */

import { CONTROL_CHAR_REPLACEMENTS, CONTROL_CHAR_PATTERN, ANSI_ESCAPE_PATTERN } from '../core/constants.js';

/**
 * Pre-compiled regex for control characters (with /g flag for replacement).
 */
const CONTROL_CHAR_REGEX = new RegExp(CONTROL_CHAR_PATTERN, 'g');

/**
 * Pre-compiled regex for testing control characters (without /g flag).
 */
const CONTROL_CHAR_TEST_REGEX = new RegExp(CONTROL_CHAR_PATTERN);

/**
 * Pre-compiled regex for ANSI escape sequences (with /g flag for replacement).
 */
const ANSI_ESCAPE_REGEX = new RegExp(ANSI_ESCAPE_PATTERN, 'g');

/**
 * Pre-compiled regex for testing ANSI sequences (without /g flag).
 */
const ANSI_ESCAPE_TEST_REGEX = new RegExp(ANSI_ESCAPE_PATTERN);

/**
 * Injection Guard class for preventing log injection attacks.
 *
 * Provides:
 * - Newline escaping (CWE-117 mitigation)
 * - Control character escaping
 * - ANSI escape sequence stripping
 *
 * @example
 * ```typescript
 * const guard = new InjectionGuard();
 * const safe = guard.sanitize('User: admin\nLevel: root'); // "User: admin\\nLevel: root"
 * ```
 */
export class InjectionGuard {
  private stripAnsi: boolean;

  /**
   * Create a new InjectionGuard.
   * @param options - Configuration options
   * @param options.stripAnsi - Whether to strip ANSI escape sequences (default: true)
   */
  constructor(options: { stripAnsi?: boolean } = {}) {
    this.stripAnsi = options.stripAnsi ?? true;
  }

  /**
   * Sanitize text to prevent log injection.
   * Replaces newlines and control characters with escaped versions.
   *
   * @param text - The text to sanitize
   * @returns Sanitized text safe for logging
   */
  public sanitize(text: string): string {
    let result = text;

    // 1. Strip ANSI escape sequences if enabled
    if (this.stripAnsi) {
      result = result.replace(ANSI_ESCAPE_REGEX, '');
    }

    // 2. Escape control characters using centralized mapping
    result = result.replace(CONTROL_CHAR_REGEX, (char) => CONTROL_CHAR_REPLACEMENTS[char] ?? char);

    return result;
  }

  /**
   * Check if text contains potential injection characters.
   *
   * @param text - The text to check
   * @returns true if the text contains injection characters
   */
  public containsInjectionChars(text: string): boolean {
    return CONTROL_CHAR_TEST_REGEX.test(text);
  }

  /**
   * Check if text contains ANSI escape sequences.
   *
   * @param text - The text to check
   * @returns true if the text contains ANSI sequences
   */
  public containsAnsiSequences(text: string): boolean {
    return ANSI_ESCAPE_TEST_REGEX.test(text);
  }
}

/**
 * Default injection guard instance.
 */
export const injectionGuard = new InjectionGuard();

/**
 * Convenience function to sanitize text for logging.
 * Uses the default injection guard instance.
 *
 * @param text - The text to sanitize
 * @returns Sanitized text
 */
export function sanitizeForLogging(text: string): string {
  return injectionGuard.sanitize(text);
}
