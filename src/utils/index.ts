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
  formatSessionId,
  formatRequestId,
  formatTraceId,
  type LogLevel,
  type LogContext,
  type StructuredLogEntry,
} from './logger/index.js';

// Error exports
export {
  AppError,
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

// Server utils (re-export from server/utils for convenience)
export { connectionManager, requestManager, type ProgressData } from '../server/utils/index.js';

// Response formatter exports
export {
  formatActionResponse,
  formatListHeader,
  formatInfoResponse,
  formatErrorResponse,
  formatLogsResponse,
  formatSearchResponse,
  formatPruneResponse,
  type ActionType,
  type ResourceType,
  type ActionResponseOptions,
  type ListResponseOptions,
  type InfoResponseOptions,
  type ErrorResponseOptions,
  type LogsResponseOptions,
  type SearchResponseOptions,
  type PruneResponseOptions,
} from './response-formatter.js';
