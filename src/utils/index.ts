/**
 * Utils Module
 *
 * Centralized exports for utility functions and classes.
 *
 * @module utils
 */

// Logger exports
export {
  logger,
  Logger,
  mcpLogger,
  McpNotificationLogger,
  McpLogLevel,
  createLogEntry,
  LogEntryBuilder,
  LOG_SEVERITY,
  type LogLevel,
  type LogContext,
  type StructuredLogEntry,
} from './logger/index.js';

// Error exports
export {
  KomodoError,
  ApiError,
  ConnectionError,
  AuthenticationError,
  NotFoundError,
  ValidationError,
  ConfigurationError,
  OperationCancelledError,
  OperationError,
  ClientNotConfiguredError,
} from './errors/index.js';

// DI exports
export { container, Container, TOKENS, createToken, type Token } from './di/index.js';

// Server utils (re-export from server/utils for convenience)
export { connectionManager, requestManager, type ProgressData } from '../server/utils/index.js';

// Format utilities
export { formatSessionId } from './format.js';
