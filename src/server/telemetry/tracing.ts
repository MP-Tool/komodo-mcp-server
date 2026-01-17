/**
 * OpenTelemetry Tracing Utilities
 *
 * Provides convenient helpers for creating and managing spans.
 *
 * @module server/telemetry/tracing
 */

import { trace, context, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import type { Span, Attributes, Context } from '@opentelemetry/api';
import { getTelemetryConfig, type SpanOptions, type TraceContext } from './core/index.js';

/**
 * Get the tracer instance for the Komodo MCP Server.
 */
export function getTracer() {
  const config = getTelemetryConfig();
  return trace.getTracer(config.serviceName, config.serviceVersion);
}

/**
 * Execute a function within a new span.
 * Automatically handles errors and sets span status.
 *
 * @param name - Name of the span
 * @param fn - Function to execute within the span
 * @param options - Span options
 * @returns The result of the function
 *
 * @example
 * ```typescript
 * const result = await withSpan('processRequest', async (span) => {
 *   span.setAttribute('request.id', requestId);
 *   return await processRequest();
 * });
 * ```
 */
export async function withSpan<T>(name: string, fn: (span: Span) => Promise<T>, options: SpanOptions = {}): Promise<T> {
  const tracer = getTracer();
  const parentContext = options.parentContext ?? context.active();

  return tracer.startActiveSpan(
    name,
    {
      kind: options.kind ?? SpanKind.INTERNAL,
      attributes: options.attributes,
    },
    parentContext,
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        // Record the error on the span
        if (error instanceof Error) {
          span.recordException(error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });
        } else {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: String(error),
          });
        }
        throw error;
      } finally {
        span.end();
      }
    },
  );
}

/**
 * Execute a synchronous function within a new span.
 *
 * @param name - Name of the span
 * @param fn - Function to execute within the span
 * @param options - Span options
 * @returns The result of the function
 */
export function withSpanSync<T>(name: string, fn: (span: Span) => T, options: SpanOptions = {}): T {
  const tracer = getTracer();
  const parentContext = options.parentContext ?? context.active();

  const span = tracer.startSpan(
    name,
    {
      kind: options.kind ?? SpanKind.INTERNAL,
      attributes: options.attributes,
    },
    parentContext,
  );

  try {
    const ctx = trace.setSpan(parentContext, span);
    const result = context.with(ctx, () => fn(span));
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    if (error instanceof Error) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
    } else {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: String(error),
      });
    }
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Get the currently active span.
 * Returns undefined if no span is active.
 */
export function getActiveSpan(): Span | undefined {
  return trace.getActiveSpan();
}

/**
 * Add attributes to the active span.
 * Does nothing if no span is active.
 */
export function addSpanAttributes(attributes: Attributes): void {
  const span = getActiveSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

/**
 * Add an event to the active span.
 * Does nothing if no span is active.
 */
export function addSpanEvent(name: string, attributes?: Attributes): void {
  const span = getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Get the current trace context for propagation.
 * Useful for passing context to external services.
 */
export function getTraceContext(): TraceContext | undefined {
  const span = getActiveSpan();
  if (!span) {
    return undefined;
  }

  const spanContext = span.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}
