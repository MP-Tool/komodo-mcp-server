/**
 * Logger Core Constants Module
 *
 * Centralized constants for the logging system.
 * All logger-related constants should be defined here for consistency
 * and to avoid magic values scattered throughout the codebase.
 *
 * @module logger/core/constants
 */

import type { LogLevel, McpLogLevel } from './types.js';

// ============================================================================
// Log Level Configuration
// ============================================================================

/**
 * Numeric values for log levels to determine if a message should be logged.
 * Higher values = more severe.
 *
 * @example
 * ```typescript
 * if (LOG_LEVELS[level] >= LOG_LEVELS[minLevel]) {
 *   // Log the message
 * }
 * ```
 */
export const LOG_LEVELS: Readonly<Record<LogLevel, number>> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
} as const;

/**
 * Log severity levels for ECS/structured logging.
 * Based on RFC 5424 syslog severity (inverted: 0 = emergency, 7 = debug).
 */
export const LOG_SEVERITY: Readonly<Record<LogLevel, number>> = {
  trace: 7, // Debug
  debug: 7, // Debug
  info: 6, // Informational
  warn: 4, // Warning
  error: 3, // Error
} as const;

/**
 * Maps internal log levels to MCP logging levels (RFC 5424).
 * MCP uses syslog-style levels which are more granular.
 */
export const LOG_LEVEL_TO_MCP: Readonly<Record<LogLevel, McpLogLevel>> = {
  trace: 'debug',
  debug: 'debug',
  info: 'info',
  warn: 'warning',
  error: 'error',
} as const;

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default log level when not specified in configuration.
 */
export const DEFAULT_LOG_LEVEL: LogLevel = 'info';

/**
 * Default log format when not specified in configuration.
 */
export const DEFAULT_LOG_FORMAT: 'json' | 'text' = 'text';

/**
 * Default component name for loggers without explicit component.
 */
export const DEFAULT_COMPONENT = 'server';

/**
 * Default service name for structured logs.
 */
export const DEFAULT_SERVICE_NAME = 'mcp-server';

// ============================================================================
// Transport Configuration
// ============================================================================

/**
 * Available transport modes.
 */
export const TRANSPORT_MODES = ['stdio', 'sse'] as const;

/**
 * Transport mode type.
 */
export type TransportMode = (typeof TRANSPORT_MODES)[number];

/**
 * Default transport mode.
 */
export const DEFAULT_TRANSPORT: TransportMode = 'stdio';

// ============================================================================
// Formatting Constants
// ============================================================================

/**
 * Maximum length for truncated session/request IDs in text logs.
 */
export const ID_DISPLAY_LENGTH = 8;

/**
 * Padding for log level alignment in text format.
 */
export const LEVEL_PAD_LENGTH = 5;

/**
 * File extension for log files.
 */
export const LOG_FILE_EXTENSION = '.log';

/**
 * Default components for file logging.
 * Streams will be created for each component.
 */
export const DEFAULT_LOG_COMPONENTS = ['server', 'api', 'transport', 'tools'] as const;

/**
 * Logger component names for the logging system.
 * Used for consistent log categorization across the logger module.
 */
export const LOGGER_COMPONENTS = {
  /** MCP protocol logger */
  MCP_LOGGER: 'McpLogger',
  /** File writer component */
  FILE_WRITER: 'FileWriter',
  /** Console writer component */
  CONSOLE_WRITER: 'ConsoleWriter',
} as const;

// ============================================================================
// Security Constants (Secret Scrubbing)
// ============================================================================

/**
 * List of keys that are considered sensitive and should be redacted from logs.
 * Includes common authentication and security-related terms.
 *
 * Note: Container keys like 'credentials' are intentionally excluded to allow
 * recursive scrubbing of their contents.
 */
export const SENSITIVE_KEYS = [
  'password',
  'passwd',
  'apiKey',
  'api_key',
  'apiSecret',
  'api_secret',
  'token',
  'secret',
  'authorization',
  'auth_token',
  'access_token',
  'refresh_token',
  'id_token',
  'jwt',
  'bearer',
  'private_key',
  'privateKey',
  'secret_key',
  'secretKey',
  'passphrase',
  'key',
] as const;

/**
 * Words that should NOT trigger sensitive key detection even if they contain
 * sensitive key patterns. This prevents false positives.
 * E.g., 'tokenizer' contains 'token' but is not sensitive.
 */
export const SENSITIVE_KEY_BLOCKLIST = [
  'tokenizer',
  'tokenize',
  'tokenization',
  'keyboard',
  'keyframe',
  'keynote',
  'monkey',
  'passthrough',
  'passenger',
  'passage',
] as const;

/**
 * Type representing a sensitive key.
 */
export type SensitiveKey = (typeof SENSITIVE_KEYS)[number];

/**
 * The string used to replace redacted values.
 */
export const REDACTED_VALUE = '**********';

/**
 * JWT prefix pattern for detection.
 */
export const JWT_PREFIX = 'eyJ';

// ============================================================================
// Security Constants (Injection Prevention - CWE-117)
// ============================================================================

/**
 * Control characters that could be used for log injection (CWE-117).
 * These are replaced to ensure one log entry = one line.
 */
export const CONTROL_CHAR_REPLACEMENTS: Readonly<Record<string, string>> = {
  '\n': '\\n', // Newline
  '\r': '\\r', // Carriage return
  '\t': '\\t', // Tab
  '\0': '\\0', // Null
  '\x0B': '\\v', // Vertical tab
  '\x0C': '\\f', // Form feed
  '\x1B': '\\e', // Escape
} as const;

/**
 * Regex pattern string for control characters.
 */
export const CONTROL_CHAR_PATTERN = '[\\n\\r\\t\\0\\x0B\\x0C\\x1B]';

/**
 * Regex pattern string for ANSI escape sequences.
 */
export const ANSI_ESCAPE_PATTERN = '\\x1B\\[[0-9;]*[a-zA-Z]';

// ============================================================================
// Context Constants
// ============================================================================

/**
 * Maximum depth for context merging to prevent infinite loops.
 */
export const MAX_CONTEXT_DEPTH = 10;

/**
 * Separator used for hierarchical component names.
 */
export const COMPONENT_SEPARATOR = '.';

// ============================================================================
// MCP Level Configuration
// ============================================================================

/**
 * Ordered list of MCP log levels (RFC 5424) for severity comparison.
 * Lower index = lower severity. Used for level filtering.
 */
export const MCP_LEVEL_ORDER: readonly McpLogLevel[] = [
  'debug',
  'info',
  'notice',
  'warning',
  'error',
  'critical',
  'alert',
  'emergency',
] as const;

// ============================================================================
// Performance Constants
// ============================================================================

/**
 * Maximum number of cached child loggers.
 * Prevents memory leaks from excessive child logger creation.
 */
export const MAX_CHILD_LOGGER_CACHE_SIZE = 100;

/**
 * Maximum message length before truncation in non-debug modes.
 */
export const MAX_MESSAGE_LENGTH = 10_000;

/**
 * Truncation suffix for long messages.
 */
export const TRUNCATION_SUFFIX = '... [truncated]';
