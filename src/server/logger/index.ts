/**
 * Logger Module
 *
 * Centralized logging utilities for the MCP server framework.
 *
 * ## Architecture
 *
 * ```
 * logger/
 * ├── core/           # Types, constants, context management
 * ├── formatters/     # Log entry formatting (text, JSON, schema)
 * ├── writers/        # Output destinations (console, file, MCP)
 * ├── scrubbing/      # Security (secret redaction, injection guard)
 * └── logger.ts       # Main Logger facade
 * ```
 *
 * ## Usage
 *
 * ```typescript
 * import { logger, configureLogger } from './server/logger/index.js';
 *
 * // Configure logger at app startup
 * configureLogger({
 *   LOG_LEVEL: 'info',
 *   LOG_FORMAT: 'text',
 *   MCP_TRANSPORT: 'http',
 *   NODE_ENV: 'production',
 *   SERVER_NAME: 'my-mcp-server',
 *   SERVER_VERSION: '1.0.0',
 * });
 *
 * // Basic logging
 * logger.info('Server started on port %d', 3000);
 * logger.error('Failed to connect', { host: 'example.com' });
 *
 * // Child logger with component context
 * const apiLogger = logger.child({ component: 'api' });
 * apiLogger.debug('Processing request');
 *
 * // Context-aware logging
 * logger.runWithContext({ requestId: 'req-123' }, () => {
 *   logger.info('Handling request'); // Includes requestId automatically
 * });
 * ```
 *
 * @module server/logger
 */

// =============================================================================
// Core Types & Constants (single source of truth)
// =============================================================================

export type {
  LogLevel,
  McpLogLevel,
  HttpContext,
  EventContext,
  LogContext,
  ILogger,
  ILogWriter,
  ILogFormatter,
  LogEntryParams,
  LoggerConfig,
} from './core/index.js';

export {
  // Log level configuration
  LOG_LEVELS,
  LOG_SEVERITY,
  LOG_LEVEL_TO_MCP,
  MCP_LEVEL_ORDER,
  // Default configuration
  DEFAULT_LOG_LEVEL,
  DEFAULT_LOG_FORMAT,
  DEFAULT_COMPONENT,
  DEFAULT_SERVICE_NAME,
  DEFAULT_LOG_COMPONENTS,
  LOGGER_COMPONENTS,
  // Transport configuration
  TRANSPORT_MODES,
  DEFAULT_TRANSPORT,
  // Formatting constants
  LOG_FILE_EXTENSION,
  ID_DISPLAY_LENGTH,
  LEVEL_PAD_LENGTH,
  // Security constants
  SENSITIVE_KEYS,
  SENSITIVE_KEY_BLOCKLIST,
  REDACTED_VALUE,
  JWT_PREFIX,
  CONTROL_CHAR_REPLACEMENTS,
  CONTROL_CHAR_PATTERN,
  ANSI_ESCAPE_PATTERN,
  // Context constants
  MAX_CONTEXT_DEPTH,
  COMPONENT_SEPARATOR,
  // Performance constants
  MAX_CHILD_LOGGER_CACHE_SIZE,
  MAX_MESSAGE_LENGTH,
  TRUNCATION_SUFFIX,
} from './core/index.js';

// Export types from constants
export type { SensitiveKey, TransportMode } from './core/index.js';

// Context management
export {
  runWithContext,
  getContext,
  getContextValue,
  hasContext,
  mergeContext,
  createChildContext,
  withExtendedContext,
  withChildContext,
  getContextDepth,
} from './core/index.js';

// Formatting utilities
export { formatSessionId, formatRequestId, formatTraceId } from './core/index.js';

// =============================================================================
// Formatters
// =============================================================================

export { createLogEntry, LogEntryBuilder, type StructuredLogEntry } from './formatters/index.js';

export { TextFormatter, textFormatter, type TextFormatterConfig } from './formatters/index.js';

export { JsonFormatter, type JsonFormatterConfig } from './formatters/index.js';

// =============================================================================
// Writers
// =============================================================================

export { BaseLogWriter } from './writers/index.js';

export { ConsoleWriter, type ConsoleWriterConfig } from './writers/index.js';

export { FileWriter, type FileWriterConfig } from './writers/index.js';

export { McpLogWriter, mcpLogWriter } from './writers/index.js';

export { CompositeWriter } from './writers/index.js';

// =============================================================================
// Security / Scrubbing
// =============================================================================

export { SecretScrubber, secretScrubber } from './scrubbing/index.js';

export { InjectionGuard, injectionGuard, sanitizeForLogging } from './scrubbing/index.js';

// =============================================================================
// Main Logger
// =============================================================================

export { logger, Logger } from './logger.js';

// Global configuration
export { configureLogger, getLoggerConfig, resetLoggerConfig, type GlobalLoggerConfig } from './logger.js';

// Factory & DI
export {
  LoggerResources,
  initializeLoggerResources,
  resetLoggerResources,
  type LoggerSystemConfig,
  type LoggerDependencies,
} from './logger.js';

// MCP Logger
export { mcpLogger, McpNotificationLogger, type McpLoggerConfig } from './mcp-logger.js';
