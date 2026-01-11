/**
 * Logger Facade Module
 *
 * Provides a unified logging interface that delegates to specialized components:
 * - Context management via core/context.ts
 * - Formatting via formatters/ (Text/JSON)
 * - Output via writers/ (Console/File/MCP)
 * - Security via scrubbing/ (SecretScrubber/InjectionGuard)
 * - Resource management via factory.ts (DI-enabled)
 *
 * This facade follows the Single Responsibility Principle by coordinating
 * the logging pipeline without implementing the details itself.
 *
 * @module utils/logger
 */

import * as util from 'util';
import { config, SERVER_NAME, SERVER_VERSION } from '../../config/index.js';

// Core types and utilities
import type { LogLevel, LogContext, ILogger, LogEntryParams } from './core/types.js';
import { LOG_LEVELS, MAX_MESSAGE_LENGTH, TRUNCATION_SUFFIX } from './core/constants.js';
import {
  runWithContext,
  getContext,
  mergeContext,
  createChildContext,
  withExtendedContext,
  withChildContext,
  getContextDepth,
} from './core/context.js';

// Factory for DI-enabled resource management
import {
  LoggerResources,
  initializeLoggerResources,
  hasLoggerResources,
  getLoggerResources,
  resetLoggerResources,
} from './factory.js';

// Re-export factory types for consumers
export type { LoggerSystemConfig, LoggerDependencies } from './factory.js';
export { LoggerResources, initializeLoggerResources, resetLoggerResources };

/**
 * Logger configuration options.
 */
export interface LoggerOptions {
  /** Component name for log categorization */
  component?: string;
  /** Override log level (uses config.LOG_LEVEL by default) */
  level?: LogLevel;
  /** Optional resources instance (for testing/DI) */
  resources?: LoggerResources;
}

/**
 * Centralized Logger Facade
 *
 * Coordinates the logging pipeline:
 * 1. Level filtering
 * 2. Message formatting (printf-style)
 * 3. Metadata extraction
 * 4. Secret scrubbing
 * 5. Formatting (Text/JSON)
 * 6. Injection prevention
 * 7. Output to writers (Console/File/MCP)
 *
 * Now uses LoggerResources for DI-enabled resource management,
 * eliminating the static state anti-pattern while maintaining
 * backward compatibility through lazy global initialization.
 *
 * @example
 * ```typescript
 * // Simple usage (global resources)
 * const logger = new Logger('api');
 * logger.info('Request received', { method: 'GET', path: '/health' });
 *
 * // DI usage (custom resources for testing)
 * const resources = new LoggerResources(config, mockDeps);
 * const testLogger = new Logger({ component: 'test', resources });
 * ```
 */
export class Logger implements ILogger {
  // ============================================================
  // Instance properties
  // ============================================================

  /** Minimum log level (numeric for fast comparison) */
  private readonly level: number;

  /** Component name for this logger instance */
  private readonly component: string;

  /** Resources instance (shared or injected) */
  private readonly resources: LoggerResources;

  // ============================================================
  // Constructor and Initialization
  // ============================================================

  /**
   * Create a new Logger instance.
   *
   * @param componentOrOptions - Component name string or options object
   */
  constructor(componentOrOptions: string | LoggerOptions = 'server') {
    if (typeof componentOrOptions === 'string') {
      this.component = componentOrOptions;
      this.level = LOG_LEVELS[config.LOG_LEVEL];
      this.resources = Logger.getOrInitializeResources();
    } else {
      this.component = componentOrOptions.component ?? 'server';
      this.level = LOG_LEVELS[componentOrOptions.level ?? config.LOG_LEVEL];
      this.resources = componentOrOptions.resources ?? Logger.getOrInitializeResources();
    }
  }

  /**
   * Get or initialize global resources lazily.
   * Provides backward compatibility with existing code.
   */
  private static getOrInitializeResources(): LoggerResources {
    if (!hasLoggerResources()) {
      initializeLoggerResources({
        level: config.LOG_LEVEL,
        format: config.LOG_FORMAT as 'text' | 'json',
        transport: config.MCP_TRANSPORT as 'stdio' | 'sse',
        serviceName: SERVER_NAME,
        serviceVersion: SERVER_VERSION,
        environment: config.NODE_ENV,
        logDir: config.LOG_DIR,
      });
    }
    return getLoggerResources();
  }

  // ============================================================
  // Static Lifecycle Methods
  // ============================================================

  /**
   * Close all writers gracefully.
   * Should be called during application shutdown.
   *
   * @returns Promise that resolves when all writers are closed
   */
  public static async closeStreams(): Promise<void> {
    if (hasLoggerResources()) {
      await getLoggerResources().close();
      await resetLoggerResources();
    }
  }

  /**
   * Clear the child logger cache.
   * Useful for testing or when configuration changes.
   */
  public static clearChildLoggerCache(): void {
    if (hasLoggerResources()) {
      getLoggerResources().clearChildLoggerCache();
    }
  }

  /**
   * Reset static state (for testing purposes).
   * Fully resets all resources.
   */
  public static async resetState(): Promise<void> {
    await resetLoggerResources();
  }

  /**
   * Synchronous reset for backward compatibility.
   * @deprecated Use resetState() async version instead
   */
  public static resetStateSync(): void {
    // Fire and forget - not ideal but maintains backward compatibility
    void resetLoggerResources();
  }

  // ============================================================
  // Child Logger Factory
  // ============================================================

  /**
   * Create a child logger with a specific component context.
   * Uses LRU caching to avoid creating new instances while preventing memory leaks.
   *
   * @param context - The component context for the child logger
   * @returns A cached or new Logger instance
   */
  public child(context: { component: string }): Logger {
    return this.resources.getOrCreateChildLogger(
      context.component,
      () => new Logger({ component: context.component, resources: this.resources }),
    );
  }

  // ============================================================
  // Context Management (delegates to core/context.ts)
  // ============================================================

  /**
   * Run a function within a logging context.
   * All logs within the function will include the context.
   *
   * @param context - The context to use for logging
   * @param fn - The function to execute
   * @returns The result of the function
   */
  public runWithContext<T>(context: LogContext, fn: () => T): T {
    return runWithContext(context, fn);
  }

  /**
   * Get the current logging context.
   *
   * @returns The current context or undefined
   */
  public getContext(): LogContext | undefined {
    return getContext();
  }

  /**
   * Merge additional context with the current context.
   *
   * @param additionalContext - Context values to add/override
   * @returns A new merged context
   */
  public mergeContext(additionalContext: Partial<LogContext>): LogContext {
    return mergeContext(additionalContext);
  }

  /**
   * Create a child context that inherits from the current context.
   * Component names are automatically concatenated.
   *
   * @param childContext - Context values for the child
   * @returns A new child context
   */
  public createChildContext(childContext: Partial<LogContext>): LogContext {
    return createChildContext(childContext);
  }

  /**
   * Execute a function with an extended context.
   *
   * @param additionalContext - Context values to add
   * @param fn - The function to execute
   * @returns The result of the function
   */
  public withExtendedContext<T>(additionalContext: Partial<LogContext>, fn: () => T): T {
    return withExtendedContext(additionalContext, fn);
  }

  /**
   * Execute a function with a child context.
   *
   * @param childContext - Context values for the child scope
   * @param fn - The function to execute
   * @returns The result of the function
   */
  public withChildContext<T>(childContext: Partial<LogContext>, fn: () => T): T {
    return withChildContext(childContext, fn);
  }

  /**
   * Get the current context nesting depth.
   *
   * @returns The current depth
   */
  public getContextDepth(): number {
    return getContextDepth();
  }

  // ============================================================
  // Log Level Methods
  // ============================================================

  /**
   * Log a message at TRACE level.
   */
  public trace(message: string, ...args: unknown[]): void {
    this.log('trace', message, ...args);
  }

  /**
   * Log a message at DEBUG level.
   */
  public debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args);
  }

  /**
   * Log a message at INFO level.
   */
  public info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args);
  }

  /**
   * Log a message at WARN level.
   */
  public warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args);
  }

  /**
   * Log a message at ERROR level.
   */
  public error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args);
  }

  // ============================================================
  // Core Logging Pipeline
  // ============================================================

  /**
   * Internal log handler implementing the logging pipeline.
   *
   * Pipeline steps:
   * 1. Level filtering
   * 2. Metadata extraction
   * 3. Printf-style formatting
   * 4. Message truncation (if exceeds MAX_MESSAGE_LENGTH)
   * 5. Context retrieval
   * 6. Secret scrubbing
   * 7. Format generation (Text/JSON)
   * 8. Injection prevention
   * 9. Output to writers
   * 10. MCP notification (if context has sendMcpLog)
   */
  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    // Step 1: Level filtering (fast path for disabled levels)
    if (LOG_LEVELS[level] < this.level) {
      return;
    }

    // Step 2: Extract metadata from args
    const { metadata, formatArgs } = this.extractMetadata(args);

    // Step 3: Printf-style message formatting
    let formattedMessage = util.format(message, ...formatArgs);

    // Step 4: Truncate long messages to prevent memory issues
    if (formattedMessage.length > MAX_MESSAGE_LENGTH) {
      formattedMessage = formattedMessage.slice(0, MAX_MESSAGE_LENGTH - TRUNCATION_SUFFIX.length) + TRUNCATION_SUFFIX;
    }

    // Step 5: Get context (from AsyncLocalStorage)
    const context = getContext();
    const component = context?.component ?? this.component;

    // Step 6: Scrub secrets from metadata
    const scrubbedMetadata = metadata
      ? (this.resources.secretScrubber.scrubObject(metadata) as Record<string, unknown>)
      : undefined;

    // Step 7: Build log entry params
    const params: LogEntryParams = {
      level,
      message: formattedMessage,
      component,
      context,
      metadata: scrubbedMetadata,
      timestamp: new Date().toISOString(),
    };

    // Step 8: Format the log entry
    const formatted = this.resources.getFormatter().format(params);

    // Step 9: Apply injection guard and secret scrubbing to final output
    const sanitized = this.resources.injectionGuard.sanitize(formatted);
    const safeOutput = this.resources.secretScrubber.scrub(sanitized);

    // Step 10: Write to outputs
    this.writeToOutputs(level, safeOutput, component);

    // Step 11: Send to MCP client if context has sendMcpLog
    if (context?.sendMcpLog) {
      const safeMessage = this.resources.secretScrubber.scrub(formattedMessage);
      context.sendMcpLog(level, safeMessage);
    }
  }

  /**
   * Extract metadata object from log arguments.
   * The last argument is treated as metadata if it's a plain object (not an Error).
   */
  private extractMetadata(args: unknown[]): {
    metadata: Record<string, unknown> | undefined;
    formatArgs: unknown[];
  } {
    if (args.length === 0) {
      return { metadata: undefined, formatArgs: [] };
    }

    const lastArg = args[args.length - 1];

    // Check if last arg is a plain object (not null, not Error)
    if (
      lastArg !== null &&
      typeof lastArg === 'object' &&
      !util.types.isNativeError(lastArg) &&
      !Array.isArray(lastArg)
    ) {
      return {
        metadata: lastArg as Record<string, unknown>,
        formatArgs: args.slice(0, -1),
      };
    }

    return { metadata: undefined, formatArgs: args };
  }

  /**
   * Write formatted output to all configured writers.
   */
  private writeToOutputs(level: LogLevel, output: string, component: string): void {
    // Console writer
    this.resources.consoleWriter?.write(level, output, component);

    // File writer (if configured)
    /* v8 ignore start - file logging requires LOG_DIR environment */
    this.resources.fileWriter?.write(level, output, component);
    /* v8 ignore stop */
  }
}

/**
 * Default logger instance for the application.
 */
export const logger = new Logger();
