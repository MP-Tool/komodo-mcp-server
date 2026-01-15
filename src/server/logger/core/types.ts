/**
 * Logger Core Types Module
 *
 * Defines the fundamental types and interfaces for the logging system.
 * These types are used throughout all logger components.
 *
 * @module logger/core/types
 */

/**
 * Available logging levels ordered by severity (lowest to highest).
 *
 * - `trace`: Very detailed debugging information
 * - `debug`: Detailed debugging information
 * - `info`: General informational messages
 * - `warn`: Warning conditions
 * - `error`: Error conditions
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

/**
 * MCP Logging levels as defined by the MCP specification (RFC 5424).
 *
 * MCP uses syslog-style levels which are more granular than our internal levels.
 */
export type McpLogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

/**
 * HTTP request context for structured logging.
 * Used to correlate logs with specific HTTP requests.
 */
export interface HttpContext {
  /** HTTP method (GET, POST, etc.) */
  method?: string;
  /** Request URL path */
  path?: string;
  /** Response status code */
  statusCode?: number;
  /** Request duration in milliseconds */
  durationMs?: number;
}

/**
 * Event context for structured logging.
 * Used to categorize and track log events.
 */
export interface EventContext {
  /** Event category (e.g., 'tool', 'api', 'transport') */
  category?: string;
  /** Event action (e.g., 'execute', 'connect', 'disconnect') */
  action?: string;
  /** Event outcome */
  outcome?: 'success' | 'failure' | 'unknown';
}

/**
 * Context for the current execution (e.g. Request ID, MCP Connection).
 * Used to correlate logs with specific requests or sessions.
 */
export interface LogContext {
  /** Unique identifier for the request */
  requestId?: string;
  /** Session identifier */
  sessionId?: string;
  /** Component name for filtering */
  component?: string;
  /** Trace ID for distributed tracing (OpenTelemetry compatible) */
  traceId?: string;
  /** Span ID for distributed tracing */
  spanId?: string;
  /** HTTP request context */
  http?: HttpContext;
  /** Event categorization for structured logs */
  event?: EventContext;
  /** Function to send logs to MCP client */
  sendMcpLog?: (level: LogLevel, message: string) => void;
  /**
   * Internal depth counter for context nesting.
   * Used to prevent infinite recursion - thread-safe as it's per-context.
   * @internal
   */
  _depth?: number;
}

/**
 * Interface for a logger instance.
 * Defines the public API that all logger implementations must follow.
 */
export interface ILogger {
  /**
   * Log a message at TRACE level.
   * @param message - The message to log (supports printf-style formatting)
   * @param args - Additional arguments for formatting or metadata
   */
  trace(message: string, ...args: unknown[]): void;

  /**
   * Log a message at DEBUG level.
   * @param message - The message to log (supports printf-style formatting)
   * @param args - Additional arguments for formatting or metadata
   */
  debug(message: string, ...args: unknown[]): void;

  /**
   * Log a message at INFO level.
   * @param message - The message to log (supports printf-style formatting)
   * @param args - Additional arguments for formatting or metadata
   */
  info(message: string, ...args: unknown[]): void;

  /**
   * Log a message at WARN level.
   * @param message - The message to log (supports printf-style formatting)
   * @param args - Additional arguments for formatting or metadata
   */
  warn(message: string, ...args: unknown[]): void;

  /**
   * Log a message at ERROR level.
   * @param message - The message to log (supports printf-style formatting)
   * @param args - Additional arguments for formatting or metadata
   */
  error(message: string, ...args: unknown[]): void;

  /**
   * Create a child logger with a specific component context.
   * @param context - The component context for the child logger
   * @returns A new logger instance with the specified context
   */
  child(context: { component: string }): ILogger;

  /**
   * Run a function within a logging context.
   * @param context - The context to use for logging
   * @param fn - The function to execute
   * @returns The result of the function
   */
  runWithContext<T>(context: LogContext, fn: () => T): T;

  /**
   * Get the current logging context.
   * @returns The current context or undefined if not in a context
   */
  getContext(): LogContext | undefined;
}

/**
 * Interface for log writers.
 * Writers are responsible for outputting formatted log entries to specific destinations.
 */
export interface ILogWriter {
  /**
   * Write a log entry to the destination.
   * @param level - The log level
   * @param message - The formatted log message
   * @param component - The component that generated the log
   */
  write(level: LogLevel, message: string, component: string): void;

  /**
   * Close the writer and release any resources.
   * @returns Promise that resolves when the writer is closed
   */
  close(): Promise<void>;

  /**
   * Check if the writer is available/ready.
   * @returns true if the writer can accept log entries
   */
  isAvailable(): boolean;
}

/**
 * Interface for log formatters.
 * Formatters are responsible for converting log data into formatted strings.
 */
export interface ILogFormatter {
  /**
   * Format a log entry.
   * @param params - The log entry parameters
   * @returns The formatted log string
   */
  format(params: LogEntryParams): string;
}

/**
 * Parameters for formatting a log entry.
 */
export interface LogEntryParams {
  /** Log level */
  level: LogLevel;
  /** Log message (may contain printf-style placeholders) */
  message: string;
  /** Format arguments for printf-style placeholders */
  formatArgs?: unknown[];
  /** Component name */
  component: string;
  /** Optional logging context */
  context?: LogContext;
  /** Optional metadata object */
  metadata?: Record<string, unknown>;
  /** Timestamp (ISO 8601) */
  timestamp?: string;
}

/**
 * Configuration for creating a logger instance.
 */
export interface LoggerConfig {
  /** Minimum log level to output */
  level: LogLevel;
  /** Log format ('json' or 'text') */
  format: 'json' | 'text';
  /** Service name for structured logs */
  serviceName: string;
  /** Service version */
  serviceVersion: string;
  /** Environment (e.g., 'development', 'production') */
  environment: string;
  /** Transport mode ('stdio' or 'sse') */
  transport: 'stdio' | 'sse';
  /** Directory for file logging (optional) */
  logDir?: string;
}
