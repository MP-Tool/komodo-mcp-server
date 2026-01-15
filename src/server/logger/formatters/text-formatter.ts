/**
 * Text Formatter Module
 *
 * Provides human-readable log formatting for development and debugging.
 * Format: [YYYY-MM-DD HH:mm:ss.SSS] [LEVEL] [Component] [Context] Message {metadata}
 *
 * @module logger/formatters/text-formatter
 */

import * as util from 'util';
import type { LogContext, ILogFormatter, LogEntryParams } from '../core/types.js';
import { ID_DISPLAY_LENGTH, LEVEL_PAD_LENGTH } from '../core/constants.js';

/**
 * Configuration for the text formatter.
 */
export interface TextFormatterConfig {
  /** Whether to include timestamps (default: true) */
  includeTimestamp?: boolean;
  /** Whether to include the component name (default: true) */
  includeComponent?: boolean;
  /** Whether to include session/request context (default: true) */
  includeContext?: boolean;
}

/**
 * Text Formatter class for human-readable log output.
 *
 * Produces logs in the format:
 * `[2024-01-15 10:30:45.123] [INFO ] [server] [sess:req] Processing request {count: 42}`
 */
export class TextFormatter implements ILogFormatter {
  private config: Required<TextFormatterConfig>;

  /**
   * Create a new TextFormatter.
   * @param config - Formatter configuration
   */
  constructor(config: TextFormatterConfig = {}) {
    this.config = {
      includeTimestamp: config.includeTimestamp ?? true,
      includeComponent: config.includeComponent ?? true,
      includeContext: config.includeContext ?? true,
    };
  }

  /**
   * Format a log entry as human-readable text.
   *
   * @param params - Log entry parameters
   * @returns Formatted text string
   */
  public format(params: LogEntryParams): string {
    const { level, message, formatArgs = [], component, context, metadata } = params;

    const parts: string[] = [];

    // Timestamp
    if (this.config.includeTimestamp) {
      const timestamp = params.timestamp ?? new Date().toISOString();
      const displayTimestamp = timestamp.replace('T', ' ').slice(0, -1);
      parts.push(`[${displayTimestamp}]`);
    }

    // Level (padded for alignment)
    const levelStr = level.toUpperCase().padEnd(LEVEL_PAD_LENGTH);
    parts.push(`[${levelStr}]`);

    // Component
    if (this.config.includeComponent) {
      parts.push(`[${component}]`);
    }

    // Context (session/request IDs)
    if (this.config.includeContext && context) {
      const contextStr = this.formatContext(context);
      if (contextStr) {
        parts.push(`[${contextStr}]`);
      }
    }

    // Message with printf-style formatting
    const formattedMessage = util.format(message, ...formatArgs);
    parts.push(formattedMessage);

    // Metadata
    if (metadata && Object.keys(metadata).length > 0) {
      parts.push(JSON.stringify(metadata));
    }

    return parts.join(' ');
  }

  /**
   * Format the context portion of the log entry.
   */
  private formatContext(context: LogContext): string {
    const parts: string[] = [];

    if (context.sessionId) {
      parts.push(context.sessionId.slice(0, ID_DISPLAY_LENGTH));
    }

    if (context.requestId) {
      if (parts.length > 0) {
        parts.push(context.requestId.slice(0, ID_DISPLAY_LENGTH));
      } else {
        parts.push(`Req:${context.requestId.slice(0, ID_DISPLAY_LENGTH)}`);
      }
    }

    return parts.join(':');
  }
}

/**
 * Default text formatter instance.
 */
export const textFormatter = new TextFormatter();
