/**
 * Tests for OpenTelemetry Tracing Utilities
 *
 * Tests the tracing helper functions:
 * - getTracer
 * - withSpan / withSpanSync
 * - getActiveSpan
 * - addSpanAttributes / addSpanEvent
 * - getTraceContext
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SpanStatusCode, SpanKind } from '@opentelemetry/api';

// Mock the OpenTelemetry API
const mockSpan = {
  setAttribute: vi.fn(),
  setAttributes: vi.fn(),
  setStatus: vi.fn(),
  addEvent: vi.fn(),
  recordException: vi.fn(),
  end: vi.fn(),
  spanContext: vi.fn(() => ({
    traceId: 'test-trace-id-1234567890abcdef',
    spanId: 'test-span-id-12345678',
  })),
};

const mockTracer = {
  startSpan: vi.fn(() => mockSpan),
  startActiveSpan: vi.fn((name, options, context, fn) => fn(mockSpan)),
};

vi.mock('@opentelemetry/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@opentelemetry/api')>();
  return {
    ...actual,
    trace: {
      getTracer: vi.fn(() => mockTracer),
      getActiveSpan: vi.fn(() => mockSpan),
      setSpan: vi.fn((ctx) => ctx),
    },
    context: {
      active: vi.fn(() => ({})),
      with: vi.fn((ctx, fn) => fn()),
    },
  };
});

// Mock telemetry config
vi.mock('../../../../src/server/telemetry/core/index.js', () => ({
  getTelemetryConfig: vi.fn(() => ({
    enabled: true,
    serviceName: 'test-service',
    serviceVersion: '1.0.0',
    environment: 'test',
  })),
  MCP_ATTRIBUTES: {
    TOOL_NAME: 'mcp.tool.name',
    REQUEST_ID: 'mcp.request.id',
    SESSION_ID: 'mcp.session.id',
  },
}));

describe('Tracing Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getTracer', () => {
    it('should return a tracer instance', async () => {
      const { getTracer } = await import('../../../../src/server/telemetry/tracing.js');

      const tracer = getTracer();

      expect(tracer).toBeDefined();
    });
  });

  describe('withSpan', () => {
    it('should execute function within a span and set OK status on success', async () => {
      const { withSpan } = await import('../../../../src/server/telemetry/tracing.js');

      const result = await withSpan('test-span', async (span) => {
        return 'success';
      });

      expect(result).toBe('success');
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should record exception and set ERROR status on failure', async () => {
      const { withSpan } = await import('../../../../src/server/telemetry/tracing.js');
      const testError = new Error('test error');

      await expect(
        withSpan('test-span', async () => {
          throw testError;
        }),
      ).rejects.toThrow('test error');

      expect(mockSpan.recordException).toHaveBeenCalledWith(testError);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'test error',
      });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should handle non-Error objects thrown', async () => {
      const { withSpan } = await import('../../../../src/server/telemetry/tracing.js');

      await expect(
        withSpan('test-span', async () => {
          throw 'string error';
        }),
      ).rejects.toBe('string error');

      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'string error',
      });
    });

    it('should pass span options', async () => {
      const { withSpan } = await import('../../../../src/server/telemetry/tracing.js');

      await withSpan(
        'test-span',
        async () => 'result',
        {
          kind: SpanKind.CLIENT,
          attributes: { 'test.attr': 'value' },
        },
      );

      expect(mockTracer.startActiveSpan).toHaveBeenCalledWith(
        'test-span',
        expect.objectContaining({
          kind: SpanKind.CLIENT,
          attributes: { 'test.attr': 'value' },
        }),
        expect.anything(),
        expect.any(Function),
      );
    });
  });

  describe('withSpanSync', () => {
    it('should execute synchronous function within a span', async () => {
      const { withSpanSync } = await import('../../../../src/server/telemetry/tracing.js');

      const result = withSpanSync('test-sync-span', (span) => {
        return 42;
      });

      expect(result).toBe(42);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: SpanStatusCode.OK });
      expect(mockSpan.end).toHaveBeenCalled();
    });

    it('should record exception on synchronous error', async () => {
      const { withSpanSync } = await import('../../../../src/server/telemetry/tracing.js');
      const testError = new Error('sync error');

      expect(() =>
        withSpanSync('test-sync-span', () => {
          throw testError;
        }),
      ).toThrow('sync error');

      expect(mockSpan.recordException).toHaveBeenCalledWith(testError);
      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: 'sync error',
      });
    });

    it('should handle non-Error objects in sync functions', async () => {
      const { withSpanSync } = await import('../../../../src/server/telemetry/tracing.js');

      expect(() =>
        withSpanSync('test-sync-span', () => {
          throw { custom: 'error' };
        }),
      ).toThrow();

      expect(mockSpan.setStatus).toHaveBeenCalledWith({
        code: SpanStatusCode.ERROR,
        message: '[object Object]',
      });
    });
  });

  describe('getActiveSpan', () => {
    it('should return the active span', async () => {
      const { getActiveSpan } = await import('../../../../src/server/telemetry/tracing.js');

      const span = getActiveSpan();

      expect(span).toBeDefined();
    });
  });

  describe('addSpanAttributes', () => {
    it('should add attributes to active span', async () => {
      const { addSpanAttributes } = await import('../../../../src/server/telemetry/tracing.js');

      addSpanAttributes({ 'test.key': 'test.value' });

      expect(mockSpan.setAttributes).toHaveBeenCalledWith({ 'test.key': 'test.value' });
    });
  });

  describe('addSpanEvent', () => {
    it('should add event to active span', async () => {
      const { addSpanEvent } = await import('../../../../src/server/telemetry/tracing.js');

      addSpanEvent('test-event', { 'event.attr': 'value' });

      expect(mockSpan.addEvent).toHaveBeenCalledWith('test-event', { 'event.attr': 'value' });
    });

    it('should add event without attributes', async () => {
      const { addSpanEvent } = await import('../../../../src/server/telemetry/tracing.js');

      addSpanEvent('simple-event');

      expect(mockSpan.addEvent).toHaveBeenCalledWith('simple-event', undefined);
    });
  });

  describe('getTraceContext', () => {
    it('should return trace context from active span', async () => {
      const { getTraceContext } = await import('../../../../src/server/telemetry/tracing.js');

      const ctx = getTraceContext();

      expect(ctx).toEqual({
        traceId: 'test-trace-id-1234567890abcdef',
        spanId: 'test-span-id-12345678',
      });
    });
  });
});

describe('Tracing Utilities - No Active Span', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle no active span gracefully for addSpanAttributes', async () => {
    // Override the mock to return undefined
    const { trace } = await import('@opentelemetry/api');
    vi.mocked(trace.getActiveSpan).mockReturnValueOnce(undefined);

    const { addSpanAttributes } = await import('../../../../src/server/telemetry/tracing.js');

    // Should not throw
    expect(() => addSpanAttributes({ key: 'value' })).not.toThrow();
  });

  it('should handle no active span gracefully for addSpanEvent', async () => {
    const { trace } = await import('@opentelemetry/api');
    vi.mocked(trace.getActiveSpan).mockReturnValueOnce(undefined);

    const { addSpanEvent } = await import('../../../../src/server/telemetry/tracing.js');

    // Should not throw
    expect(() => addSpanEvent('event')).not.toThrow();
  });

  it('should return undefined for getTraceContext when no active span', async () => {
    const { trace } = await import('@opentelemetry/api');
    vi.mocked(trace.getActiveSpan).mockReturnValueOnce(undefined);

    const { getTraceContext } = await import('../../../../src/server/telemetry/tracing.js');

    expect(getTraceContext()).toBeUndefined();
  });
});
