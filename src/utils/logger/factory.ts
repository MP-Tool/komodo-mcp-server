/**
 * Logger Factory Module
 *
 * Provides dependency injection and testable configuration for the logging system.
 * Eliminates static state anti-pattern while maintaining backward compatibility.
 *
 * @module logger/factory
 */

import type { ILogFormatter, ILogWriter, LogLevel } from './core/types.js';
import { TextFormatter } from './formatters/text-formatter.js';
import { JsonFormatter } from './formatters/json-formatter.js';
import { ConsoleWriter } from './writers/console-writer.js';
import { FileWriter } from './writers/file-writer.js';
import { SecretScrubber } from './scrubbing/secret-scrubber.js';
import { InjectionGuard } from './scrubbing/injection-guard.js';
import { MAX_CHILD_LOGGER_CACHE_SIZE } from './core/constants.js';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Complete configuration for the logging system.
 */
export interface LoggerSystemConfig {
  /** Minimum log level */
  level: LogLevel;
  /** Output format (text or json) */
  format: 'text' | 'json';
  /** Transport mode (affects console output) */
  transport: 'stdio' | 'sse';
  /** Service name for structured logs */
  serviceName: string;
  /** Service version for structured logs */
  serviceVersion: string;
  /** Environment name */
  environment: string;
  /** Directory for file logging (optional) */
  logDir?: string;
  /** Maximum size of child logger cache */
  maxChildLoggerCacheSize?: number;
}

/**
 * Dependencies that can be injected for testing.
 */
export interface LoggerDependencies {
  textFormatter?: ILogFormatter;
  jsonFormatter?: ILogFormatter;
  consoleWriter?: ILogWriter;
  fileWriter?: ILogWriter;
  secretScrubber?: SecretScrubber;
  injectionGuard?: InjectionGuard;
}

// ============================================================================
// Logger Resources Container
// ============================================================================

/**
 * Container for logger resources.
 * Encapsulates all shared resources that were previously static.
 */
export class LoggerResources {
  readonly textFormatter: ILogFormatter;
  readonly jsonFormatter: ILogFormatter | null;
  readonly consoleWriter: ILogWriter | null;
  readonly fileWriter: ILogWriter | null;
  readonly secretScrubber: SecretScrubber;
  readonly injectionGuard: InjectionGuard;
  readonly format: 'text' | 'json';
  readonly maxChildLoggerCacheSize: number;

  /** Child logger cache with LRU eviction */
  private readonly childLoggerCache = new Map<string, unknown>();
  private readonly childLoggerOrder: string[] = [];

  constructor(config: LoggerSystemConfig, deps: LoggerDependencies = {}) {
    this.format = config.format;
    this.maxChildLoggerCacheSize = config.maxChildLoggerCacheSize ?? MAX_CHILD_LOGGER_CACHE_SIZE;

    // Initialize formatters
    this.textFormatter = deps.textFormatter ?? new TextFormatter();
    this.jsonFormatter =
      config.format === 'json'
        ? (deps.jsonFormatter ??
          new JsonFormatter({
            serviceName: config.serviceName,
            serviceVersion: config.serviceVersion,
            environment: config.environment,
          }))
        : null;

    // Initialize writers
    this.consoleWriter =
      deps.consoleWriter ??
      new ConsoleWriter({
        transport: config.transport,
      });

    // File writer (optional)
    this.fileWriter = config.logDir ? (deps.fileWriter ?? this.createFileWriter(config.logDir)) : null;

    // Security components
    this.secretScrubber = deps.secretScrubber ?? new SecretScrubber();
    this.injectionGuard = deps.injectionGuard ?? new InjectionGuard();
  }

  /**
   * Create file writer with error handling.
   */
  private createFileWriter(logDir: string): ILogWriter | null {
    try {
      return new FileWriter({ logDir });
    } catch {
      // File logging is optional, continue without it
      return null;
    }
  }

  /**
   * Get the appropriate formatter based on configuration.
   */
  getFormatter(): ILogFormatter {
    return this.format === 'json' && this.jsonFormatter ? this.jsonFormatter : this.textFormatter;
  }

  /**
   * Get or create a cached child logger.
   * Uses LRU eviction to prevent memory leaks.
   */
  getOrCreateChildLogger<T>(key: string, factory: () => T): T {
    const cached = this.childLoggerCache.get(key);
    if (cached) {
      // Move to end of order (most recently used)
      const index = this.childLoggerOrder.indexOf(key);
      if (index > -1) {
        this.childLoggerOrder.splice(index, 1);
      }
      this.childLoggerOrder.push(key);
      return cached as T;
    }

    // Evict oldest entries if cache is full (LRU)
    while (this.childLoggerCache.size >= this.maxChildLoggerCacheSize && this.childLoggerOrder.length > 0) {
      const oldest = this.childLoggerOrder.shift();
      if (oldest) {
        this.childLoggerCache.delete(oldest);
      }
    }

    const newLogger = factory();
    this.childLoggerCache.set(key, newLogger);
    this.childLoggerOrder.push(key);
    return newLogger;
  }

  /**
   * Clear the child logger cache.
   */
  clearChildLoggerCache(): void {
    this.childLoggerCache.clear();
    this.childLoggerOrder.length = 0;
  }

  /**
   * Get the current cache size.
   */
  getChildLoggerCacheSize(): number {
    return this.childLoggerCache.size;
  }

  /**
   * Close all writers gracefully.
   */
  async close(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    if (this.fileWriter) {
      closePromises.push(this.fileWriter.close());
    }

    if (this.consoleWriter) {
      closePromises.push(this.consoleWriter.close());
    }

    await Promise.allSettled(closePromises);
  }
}

// ============================================================================
// Global Resources (Singleton for backward compatibility)
// ============================================================================

/**
 * Global resources instance.
 * Provides backward compatibility with existing static Logger usage.
 * @internal
 */
let globalResources: LoggerResources | null = null;

/**
 * Initialize global logger resources.
 * Called once with the application configuration.
 *
 * @param config - Logger system configuration
 * @param deps - Optional dependencies for testing
 * @returns The initialized resources
 */
export function initializeLoggerResources(config: LoggerSystemConfig, deps?: LoggerDependencies): LoggerResources {
  if (globalResources) {
    // Already initialized - return existing instance
    return globalResources;
  }

  globalResources = new LoggerResources(config, deps);
  return globalResources;
}

/**
 * Get the global logger resources.
 * Throws if not initialized.
 *
 * @returns The global resources
 * @throws Error if resources not initialized
 */
export function getLoggerResources(): LoggerResources {
  if (!globalResources) {
    throw new Error('Logger resources not initialized. Call initializeLoggerResources() first.');
  }
  return globalResources;
}

/**
 * Check if global resources are initialized.
 */
export function hasLoggerResources(): boolean {
  return globalResources !== null;
}

/**
 * Reset global resources (for testing).
 * Closes existing resources before resetting.
 *
 * @internal
 */
export async function resetLoggerResources(): Promise<void> {
  if (globalResources) {
    await globalResources.close();
    globalResources = null;
  }
}

/**
 * Force set global resources (for testing only).
 * Bypasses initialization check.
 *
 * @internal
 */
export function _setLoggerResources(resources: LoggerResources | null): void {
  globalResources = resources;
}
