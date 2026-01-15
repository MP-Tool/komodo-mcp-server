/**
 * Console Log Writer Module
 *
 * Writes log entries to stdout/stderr based on transport mode and log level.
 * In stdio mode, ALL logs go to stderr to avoid corrupting JSON-RPC on stdout.
 * In SSE mode, info/debug go to stdout, warn/error go to stderr.
 *
 * @module logger/writers/console-writer
 */

import type { LogLevel } from '../core/types.js';
import type { TransportMode } from '../core/constants.js';
import { BaseLogWriter } from './base-writer.js';

/**
 * Configuration for the console writer.
 */
export interface ConsoleWriterConfig {
  /** Transport mode ('stdio' or 'sse') */
  transport: TransportMode;
}

/**
 * Console Writer class for terminal output.
 *
 * Handles the complexity of MCP transport modes:
 * - **stdio mode**: ALL output goes to stderr (stdout is reserved for JSON-RPC)
 * - **sse mode**: Standard behavior (info/debug → stdout, warn/error → stderr)
 *
 * @example
 * ```typescript
 * const writer = new ConsoleWriter({ transport: 'stdio' });
 * writer.write('info', 'Hello world', 'server'); // Goes to stderr
 * ```
 */
export class ConsoleWriter extends BaseLogWriter {
  private transport: TransportMode;

  /**
   * Create a new ConsoleWriter.
   * @param config - Writer configuration
   */
  constructor(config: ConsoleWriterConfig) {
    super();
    this.transport = config.transport;
  }

  /**
   * Write a log message to the appropriate console stream.
   *
   * @param level - The log level
   * @param message - The formatted log message
   * @param _component - The component (unused, but part of interface)
   */
  write(level: LogLevel, message: string, _component: string): void {
    if (!this.enabled) return;

    // In stdio mode, MUST write to stderr to avoid corrupting JSON-RPC on stdout
    if (this.transport === 'stdio') {
      process.stderr.write(message + '\n');
      return;
    }

    // In SSE mode, use standard console behavior
    if (level === 'error' || level === 'warn') {
      process.stderr.write(message + '\n');
    } else {
      process.stdout.write(message + '\n');
    }
  }

  /**
   * Update the transport mode.
   * Useful when transport changes at runtime.
   *
   * @param transport - The new transport mode
   */
  setTransport(transport: TransportMode): void {
    this.transport = transport;
  }

  /**
   * Get the current transport mode.
   */
  getTransport(): TransportMode {
    return this.transport;
  }
}
