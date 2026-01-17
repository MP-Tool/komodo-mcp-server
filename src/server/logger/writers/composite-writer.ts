/**
 * Composite Log Writer Module
 *
 * Combines multiple log writers into a single writer interface.
 * Delegates write operations to all registered writers.
 *
 * @module logger/writers/composite-writer
 */

import type { LogLevel, ILogWriter } from '../core/types.js';
import { BaseLogWriter } from './base-writer.js';

/**
 * Composite Writer class that combines multiple writers.
 *
 * This is the primary writer used by the Logger class.
 * It manages multiple output destinations (console, file, MCP)
 * and ensures all enabled writers receive log entries.
 *
 * @example
 * ```typescript
 * const composite = new CompositeWriter();
 * composite.addWriter('console', consoleWriter);
 * composite.addWriter('file', fileWriter);
 * composite.write('info', 'Hello world', 'server'); // Goes to both writers
 * ```
 */
export class CompositeWriter extends BaseLogWriter {
  private writers: Map<string, ILogWriter> = new Map();

  /**
   * Add a named writer to the composite.
   *
   * @param name - Unique name for the writer
   * @param writer - The writer instance
   */
  addWriter(name: string, writer: ILogWriter): void {
    this.writers.set(name, writer);
  }

  /**
   * Remove a writer by name.
   *
   * @param name - The writer name to remove
   * @returns true if a writer was removed
   */
  removeWriter(name: string): boolean {
    return this.writers.delete(name);
  }

  /**
   * Get a writer by name.
   *
   * @param name - The writer name
   * @returns The writer or undefined
   */
  getWriter(name: string): ILogWriter | undefined {
    return this.writers.get(name);
  }

  /**
   * Check if a writer exists.
   *
   * @param name - The writer name
   * @returns true if the writer exists
   */
  hasWriter(name: string): boolean {
    return this.writers.has(name);
  }

  /**
   * Write to all enabled writers.
   *
   * @param level - The log level
   * @param message - The formatted log message
   * @param component - The component that generated the log
   */
  write(level: LogLevel, message: string, component: string): void {
    if (!this.enabled) return;

    for (const writer of this.writers.values()) {
      if (writer.isAvailable()) {
        writer.write(level, message, component);
      }
    }
  }

  /**
   * Close all writers.
   *
   * @returns Promise that resolves when all writers are closed
   */
  async close(): Promise<void> {
    const closePromises = Array.from(this.writers.values()).map((writer) => writer.close());
    await Promise.allSettled(closePromises);
    this.writers.clear();
    await super.close();
  }

  /**
   * Check if any writer is available.
   */
  isAvailable(): boolean {
    if (!this.enabled) return false;

    for (const writer of this.writers.values()) {
      if (writer.isAvailable()) return true;
    }
    return false;
  }

  /**
   * Get the number of registered writers.
   */
  getWriterCount(): number {
    return this.writers.size;
  }

  /**
   * Get all writer names.
   */
  getWriterNames(): string[] {
    return Array.from(this.writers.keys());
  }
}
