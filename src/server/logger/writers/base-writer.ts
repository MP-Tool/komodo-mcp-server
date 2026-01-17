/**
 * Base Log Writer Module
 *
 * Defines the abstract base class for all log writers.
 * Writers are responsible for outputting log entries to specific destinations.
 *
 * @module logger/writers/base-writer
 */

import type { LogLevel, ILogWriter } from '../core/types.js';

/**
 * Abstract base class for log writers.
 * Provides common functionality for all writer implementations.
 */
export abstract class BaseLogWriter implements ILogWriter {
  protected enabled: boolean = true;

  /**
   * Write a log entry to the destination.
   * Must be implemented by subclasses.
   *
   * @param level - The log level
   * @param message - The formatted log message
   * @param component - The component that generated the log
   */
  abstract write(level: LogLevel, message: string, component: string): void;

  /**
   * Close the writer and release any resources.
   * Override in subclasses that need cleanup.
   *
   * @returns Promise that resolves when the writer is closed
   */
  async close(): Promise<void> {
    this.enabled = false;
  }

  /**
   * Check if the writer is available/ready.
   *
   * @returns true if the writer can accept log entries
   */
  isAvailable(): boolean {
    return this.enabled;
  }

  /**
   * Enable or disable the writer.
   *
   * @param enabled - Whether the writer should be enabled
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}
