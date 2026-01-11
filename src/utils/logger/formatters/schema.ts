/**
 * Structured Log Schema Module
 *
 * Defines the JSON log format compatible with ELK Stack, Datadog, Splunk,
 * and other log aggregation platforms.
 *
 * Based on:
 * - Elastic Common Schema (ECS) 8.x
 * - OpenTelemetry Semantic Conventions
 * - RFC 5424 Syslog
 *
 * @module logger/formatters/schema
 */

import type { LogLevel } from '../core/types.js';
import type { SerializedError } from '../../errors/index.js';
import { LOG_LEVELS } from '../core/constants.js';

/**
 * Structured log entry for JSON output.
 * Compatible with ECS (Elastic Common Schema) for log aggregation.
 */
export interface StructuredLogEntry {
  /** ISO 8601 timestamp with milliseconds */
  '@timestamp': string;

  /** Log level (uppercase for ECS compatibility) */
  level: Uppercase<LogLevel>;

  /** Log level as numeric severity (RFC 5424: 0-7, inverted for filtering) */
  'log.level': number;

  /** Human-readable log message */
  message: string;

  /** Service identification */
  service: {
    /** Service name (e.g., 'komodo-mcp-server') */
    name: string;
    /** Service version */
    version?: string;
    /** Environment (development, production, test) */
    environment?: string;
    /** Component within the service */
    component?: string;
  };

  /** Trace context for distributed tracing */
  trace?: {
    /** Trace ID (W3C Trace Context format) */
    id?: string;
    /** Span ID */
    'span.id'?: string;
    /** Parent span ID */
    'parent.id'?: string;
  };

  /** Session information */
  session?: {
    /** Session ID */
    id?: string;
  };

  /** HTTP request context (if applicable) */
  http?: {
    /** HTTP method */
    method?: string;
    /** Request URL path */
    'url.path'?: string;
    /** Response status code */
    'response.status_code'?: number;
    /** Request duration in milliseconds */
    'request.duration_ms'?: number;
  };

  /** Error information (if this is an error log) */
  error?: {
    /** Error type/class name */
    type?: string;
    /** Error message */
    message?: string;
    /** Application-specific error code */
    code?: string;
    /** Stack trace (array of frames) */
    stack_trace?: string;
  };

  /** Event metadata */
  event?: {
    /** Event category (e.g., 'tool', 'api', 'transport') */
    category?: string;
    /** Event action (e.g., 'execute', 'connect', 'disconnect') */
    action?: string;
    /** Event outcome ('success', 'failure', 'unknown') */
    outcome?: 'success' | 'failure' | 'unknown';
    /** Event duration in nanoseconds */
    duration?: number;
  };

  /** Labels for custom indexing */
  labels?: Record<string, string | number | boolean>;

  /** Additional metadata (custom fields) */
  metadata?: Record<string, unknown>;
}

/**
 * Builder class for creating structured log entries.
 * Provides a fluent API for constructing log entries.
 *
 * @example
 * ```typescript
 * const entry = new LogEntryBuilder('info', 'User logged in')
 *   .withService('komodo-mcp-server', '1.0.0')
 *   .withSession('abc123')
 *   .withEvent('auth', 'login', 'success')
 *   .build();
 * ```
 */
export class LogEntryBuilder {
  private entry: StructuredLogEntry;

  constructor(level: LogLevel, message: string) {
    this.entry = {
      '@timestamp': new Date().toISOString(),
      level: level.toUpperCase() as Uppercase<LogLevel>,
      'log.level': LOG_LEVELS[level],
      message,
      service: {
        name: 'komodo-mcp-server',
      },
    };
  }

  /**
   * Set service information.
   */
  withService(name: string, version?: string, environment?: string, component?: string): this {
    this.entry.service = {
      name,
      version,
      environment,
      component,
    };
    return this;
  }

  /**
   * Set trace context for distributed tracing.
   */
  withTrace(traceId?: string, spanId?: string, parentId?: string): this {
    if (traceId || spanId || parentId) {
      this.entry.trace = {
        id: traceId,
        'span.id': spanId,
        'parent.id': parentId,
      };
    }
    return this;
  }

  /**
   * Set session information.
   */
  withSession(sessionId?: string): this {
    if (sessionId) {
      this.entry.session = { id: sessionId };
    }
    return this;
  }

  /**
   * Set HTTP request context.
   */
  withHttp(method?: string, path?: string, statusCode?: number, durationMs?: number): this {
    if (method || path || statusCode !== undefined || durationMs !== undefined) {
      this.entry.http = {
        method,
        'url.path': path,
        'response.status_code': statusCode,
        'request.duration_ms': durationMs,
      };
    }
    return this;
  }

  /**
   * Set error information.
   */
  withError(error: Error | SerializedError): this {
    if ('toJSON' in error && typeof error.toJSON === 'function') {
      // KomodoError with serialization
      const serialized = error.toJSON() as SerializedError;
      this.entry.error = {
        type: serialized.name,
        message: serialized.message,
        code: serialized.code,
        stack_trace: serialized.stack,
      };
    } else if (error instanceof Error) {
      this.entry.error = {
        type: error.name,
        message: error.message,
        stack_trace: error.stack,
      };
    } else {
      // SerializedError object
      this.entry.error = {
        type: error.name,
        message: error.message,
        code: error.code,
        stack_trace: error.stack,
      };
    }
    return this;
  }

  /**
   * Set event metadata.
   */
  withEvent(
    category?: string,
    action?: string,
    outcome?: 'success' | 'failure' | 'unknown',
    durationNs?: number,
  ): this {
    if (category || action || outcome || durationNs !== undefined) {
      this.entry.event = {
        category,
        action,
        outcome,
        duration: durationNs,
      };
    }
    return this;
  }

  /**
   * Add custom labels for indexing.
   */
  withLabels(labels: Record<string, string | number | boolean>): this {
    this.entry.labels = { ...this.entry.labels, ...labels };
    return this;
  }

  /**
   * Add additional metadata.
   */
  withMetadata(metadata: Record<string, unknown>): this {
    this.entry.metadata = { ...this.entry.metadata, ...metadata };
    return this;
  }

  /**
   * Build the final log entry.
   */
  build(): StructuredLogEntry {
    // Clean up undefined values for cleaner JSON output
    return JSON.parse(JSON.stringify(this.entry));
  }

  /**
   * Build and stringify the log entry.
   */
  toString(): string {
    return JSON.stringify(this.build());
  }
}

/**
 * Helper function to create a structured log entry.
 */
export function createLogEntry(level: LogLevel, message: string): LogEntryBuilder {
  return new LogEntryBuilder(level, message);
}
