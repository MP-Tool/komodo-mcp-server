/**
 * JSON Formatter Module
 *
 * Provides structured JSON log formatting compatible with ELK Stack,
 * Datadog, Splunk, and other log aggregation platforms.
 *
 * @module logger/formatters/json-formatter
 */

import type { ILogFormatter, LogEntryParams } from '../core/types.js';
import { createLogEntry } from './schema.js';

/**
 * Configuration for the JSON formatter.
 */
export interface JsonFormatterConfig {
  /** Service name for structured logs */
  serviceName: string;
  /** Service version */
  serviceVersion: string;
  /** Environment (e.g., 'development', 'production') */
  environment: string;
  /** Whether to pretty-print JSON (default: false) */
  prettyPrint?: boolean;
}

/**
 * JSON Formatter class for structured log output.
 *
 * Produces ECS-compatible JSON logs suitable for log aggregation platforms.
 */
export class JsonFormatter implements ILogFormatter {
  private config: JsonFormatterConfig;
  private prettyPrint: boolean;

  /**
   * Create a new JsonFormatter.
   * @param config - Formatter configuration
   */
  constructor(config: JsonFormatterConfig) {
    this.config = config;
    this.prettyPrint = config.prettyPrint ?? false;
  }

  /**
   * Format a log entry as JSON.
   *
   * @param params - Log entry parameters
   * @returns JSON string
   */
  public format(params: LogEntryParams): string {
    const { level, message, component, context, metadata } = params;

    const builder = createLogEntry(level, message)
      .withService(this.config.serviceName, this.config.serviceVersion, this.config.environment, component)
      .withTrace(context?.traceId, context?.spanId)
      .withSession(context?.sessionId);

    // Add HTTP context if available
    if (context?.http) {
      builder.withHttp(context.http.method, context.http.path, context.http.statusCode, context.http.durationMs);
    }

    // Add event context if available
    if (context?.event) {
      builder.withEvent(context.event.category, context.event.action, context.event.outcome);
    }

    // Add metadata
    if (metadata && Object.keys(metadata).length > 0) {
      builder.withMetadata(metadata);
    }

    // Add request ID as label for easy filtering
    if (context?.requestId) {
      builder.withLabels({ request_id: context.requestId });
    }

    const entry = builder.build();

    if (this.prettyPrint) {
      return JSON.stringify(entry, null, 2);
    }

    return JSON.stringify(entry);
  }
}
