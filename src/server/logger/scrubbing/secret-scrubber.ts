/**
 * Secret Scrubber Module
 *
 * Provides utilities for detecting and redacting sensitive information from logs.
 * Handles JWTs, Bearer tokens, and key-value pairs with sensitive keys.
 *
 * @module logger/scrubbing/secret-scrubber
 */

import { SENSITIVE_KEYS, SENSITIVE_KEY_BLOCKLIST, REDACTED_VALUE, JWT_PREFIX } from '../core/constants.js';

/**
 * Pre-compiled regex patterns for secret scrubbing.
 * Performance optimization: compile once at module load instead of on every log call.
 */

/** Regex to match JWTs (eyJ...) - three base64 segments separated by dots */
const JWT_REGEX = new RegExp(`\\b${JWT_PREFIX}[a-zA-Z0-9-_]+\\.[a-zA-Z0-9-_]+\\.[a-zA-Z0-9-_]+`, 'g');

/** Regex to match Bearer tokens */
const BEARER_REGEX = /\bBearer\s+[a-zA-Z0-9._-]+/gi;

/** Regex to match key-value pairs with sensitive keys (excluding bearer/authorization) */
const KV_PATTERN = SENSITIVE_KEYS.filter((k) => !['bearer', 'authorization'].includes(k.toLowerCase())).join('|');
const KV_REGEX = new RegExp(`\\b(${KV_PATTERN})\\b(\\s*[:=]\\s*)(["']?)([^\\s"']+)\\3`, 'gi');

/**
 * Secret Scrubber class for detecting and redacting sensitive information.
 *
 * Usage:
 * - Create a scrubber: `const scrubber = new SecretScrubber();`
 * - Scrub a string: `scrubber.scrub('token=secret123')` returns `'token=**********'`
 * - Scrub an object: `scrubber.scrubObject({ password: 'secret' })` returns `{ password: '**********' }`
 */
export class SecretScrubber {
  private sensitiveKeys: readonly string[];
  private blocklist: readonly string[];

  /**
   * Create a new SecretScrubber.
   * @param additionalKeys - Additional keys to consider sensitive
   */
  constructor(additionalKeys: string[] = []) {
    this.sensitiveKeys = [...SENSITIVE_KEYS, ...additionalKeys];
    this.blocklist = [...SENSITIVE_KEY_BLOCKLIST];
  }

  /**
   * Scrub secrets from a text string.
   *
   * Handles:
   * - JWTs (eyJ...)
   * - Bearer tokens
   * - Key-value pairs with sensitive keys
   *
   * @param text - The text to scrub
   * @returns The scrubbed text
   */
  public scrub(text: string): string {
    let scrubbed = text;

    // 1. Known Secret Formats (High Confidence) - JWT
    scrubbed = scrubbed.replace(JWT_REGEX, REDACTED_VALUE);

    // 2. Common Auth Headers - Bearer token
    // Run before generic KV scrubber to ensure "Bearer <token>" is handled as a unit
    scrubbed = scrubbed.replace(BEARER_REGEX, `Bearer ${REDACTED_VALUE}`);

    // 3. Context-based Scrubbing (Key-Value pairs)
    scrubbed = scrubbed.replace(KV_REGEX, (match, key, sep, quote, value) => {
      // Don't redact if already redacted
      if (value.includes(REDACTED_VALUE)) return match;
      return `${key}${sep}${quote}${REDACTED_VALUE}${quote}`;
    });

    return scrubbed;
  }

  /**
   * Recursively scrub sensitive keys from an object.
   *
   * Also scrubs string values that may contain embedded secrets
   * (e.g., "password=secret123" patterns).
   *
   * @param obj - The object to scrub
   * @returns A new object with sensitive values redacted
   */
  public scrubObject(obj: unknown): unknown {
    if (typeof obj !== 'object' || obj === null) {
      // Scrub string values for embedded secrets (e.g., "token=abc123")
      if (typeof obj === 'string') {
        return this.scrub(obj);
      }
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.scrubObject(item));
    }

    const redacted: Record<string, unknown> = {};
    const objRecord = obj as Record<string, unknown>;

    for (const key in objRecord) {
      if (Object.prototype.hasOwnProperty.call(objRecord, key)) {
        if (this.isSensitiveKey(key)) {
          redacted[key] = REDACTED_VALUE;
        } else if (typeof objRecord[key] === 'object') {
          redacted[key] = this.scrubObject(objRecord[key]);
        } else if (typeof objRecord[key] === 'string') {
          // Scrub string values for embedded secrets
          redacted[key] = this.scrub(objRecord[key] as string);
        } else {
          redacted[key] = objRecord[key];
        }
      }
    }

    return redacted;
  }

  /**
   * Check if a key is sensitive.
   * Uses substring matching with a blocklist to avoid false positives.
   *
   * @param key - The key to check
   * @returns true if the key matches a sensitive pattern
   */
  public isSensitiveKey(key: string): boolean {
    const lowerKey = key.toLowerCase();

    // First check blocklist - if the key is in blocklist, it's not sensitive
    for (const blocked of this.blocklist) {
      if (lowerKey === blocked.toLowerCase() || lowerKey.includes(blocked.toLowerCase())) {
        return false;
      }
    }

    // Check if key contains any sensitive pattern
    for (const sensitiveKey of this.sensitiveKeys) {
      if (lowerKey.includes(sensitiveKey.toLowerCase())) {
        return true;
      }
    }

    return false;
  }
}

/**
 * Default secret scrubber instance.
 */
export const secretScrubber = new SecretScrubber();
