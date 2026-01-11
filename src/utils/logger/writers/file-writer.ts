/**
 * File Log Writer Module
 *
 * Writes log entries to files organized by component.
 * Handles stream creation, directory management, and graceful shutdown.
 *
 * @module logger/writers/file-writer
 */

import * as fs from 'fs';
import * as path from 'path';
import type { LogLevel } from '../core/types.js';
import { DEFAULT_LOG_COMPONENTS, LOG_FILE_EXTENSION } from '../core/constants.js';
import { BaseLogWriter } from './base-writer.js';

/**
 * Configuration for the file writer.
 */
export interface FileWriterConfig {
  /** Directory to write log files to */
  logDir: string;
  /** Component names to create streams for (default: ['server', 'api', 'transport']) */
  components?: readonly string[];
  /** File extension for log files (default: '.log') */
  extension?: string;
  /** Fallback component when requested component has no stream */
  fallbackComponent?: string;
}

/**
 * File Writer class for writing logs to files.
 *
 * Features:
 * - Creates separate log files per component
 * - Automatic directory creation
 * - Graceful stream shutdown
 * - Fallback to default component when stream not found
 *
 * @example
 * ```typescript
 * const writer = new FileWriter({ logDir: '/var/log/app' });
 * writer.write('info', 'Server started', 'server');
 * await writer.close();
 * ```
 */
export class FileWriter extends BaseLogWriter {
  private streams: Map<string, fs.WriteStream> = new Map();
  private logDir: string;
  private extension: string;
  private fallbackComponent: string;
  private initialized: boolean = false;

  /**
   * Create a new FileWriter.
   * @param config - Writer configuration
   */
  constructor(config: FileWriterConfig) {
    super();
    this.logDir = config.logDir;
    this.extension = config.extension ?? LOG_FILE_EXTENSION;
    this.fallbackComponent = config.fallbackComponent ?? 'server';
    this.initialize(config.components ?? DEFAULT_LOG_COMPONENTS);
  }

  /**
   * Initialize streams for the specified components.
   */
  private initialize(components: readonly string[]): void {
    if (this.initialized) return;

    try {
      // Ensure log directory exists
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }

      // Create streams for each component
      for (const component of components) {
        this.createStream(component);
      }

      this.initialized = true;
    } catch {
      // Silently fail - file logging is optional
      // The writer will return isAvailable() = false
      this.enabled = false;
    }
  }

  /**
   * Create a write stream for a component.
   * Includes error handling to prevent unhandled stream errors.
   */
  private createStream(component: string): boolean {
    if (this.streams.has(component)) {
      return true;
    }

    try {
      const filePath = path.join(this.logDir, `${component}${this.extension}`);
      const stream = fs.createWriteStream(filePath, { flags: 'a' });

      // Handle stream errors to prevent unhandled exceptions
      stream.on('error', (err) => {
        // Log to stderr since our logger might not be available
        process.stderr.write(`[FileWriter] Stream error for ${component}: ${err.message}\n`);
        // Remove the broken stream
        this.streams.delete(component);
      });
      this.streams.set(component, stream);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Write a log message to the appropriate file.
   *
   * @param _level - The log level (unused for files)
   * @param message - The formatted log message
   * @param component - The component (determines which file)
   */
  write(_level: LogLevel, message: string, component: string): void {
    if (!this.enabled || !this.initialized) return;

    // Get stream for component or fallback
    const stream = this.streams.get(component) ?? this.streams.get(this.fallbackComponent);
    if (stream) {
      stream.write(message + '\n');
    }
  }

  /**
   * Close all streams gracefully.
   * Should be called during application shutdown to ensure all logs are flushed.
   *
   * @returns Promise that resolves when all streams are closed
   */
  async close(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    for (const [, stream] of this.streams.entries()) {
      closePromises.push(
        new Promise<void>((resolve) => {
          stream.end(() => {
            stream.close(() => resolve());
          });
        }),
      );
    }

    await Promise.allSettled(closePromises);
    this.streams.clear();
    this.initialized = false;
    await super.close();
  }

  /**
   * Check if the writer has been initialized successfully.
   */
  isAvailable(): boolean {
    return this.enabled && this.initialized;
  }

  /**
   * Check if a stream exists for a component.
   */
  hasStream(component: string): boolean {
    return this.streams.has(component);
  }

  /**
   * Add a new stream for a component.
   *
   * @param component - The component name
   * @returns true if stream was created successfully
   */
  addStream(component: string): boolean {
    return this.createStream(component);
  }

  /**
   * Get the number of active streams.
   */
  getStreamCount(): number {
    return this.streams.size;
  }
}
