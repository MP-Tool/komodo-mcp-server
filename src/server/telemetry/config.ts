/**
 * OpenTelemetry Configuration
 *
 * Provides distributed tracing capabilities for the Komodo MCP Server.
 * Integrates with OTLP collectors (Jaeger, Zipkin, Datadog, etc.).
 *
 * ## Activation
 *
 * Set the following environment variables:
 * - `OTEL_ENABLED=true` - Enable OpenTelemetry
 * - `OTEL_SERVICE_NAME=komodo-mcp-server` - Service name (optional)
 * - `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` - OTLP endpoint
 *
 * ## Usage
 *
 * ```typescript
 * import { tracer, withSpan, getActiveSpan } from './telemetry/index.js';
 *
 * // Create a span
 * await withSpan('myOperation', async (span) => {
 *   span.setAttribute('key', 'value');
 *   // ... operation code
 * });
 * ```
 *
 * @module telemetry/config
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

/**
 * OpenTelemetry configuration options.
 */
export interface TelemetryConfig {
  /** Whether OpenTelemetry is enabled */
  enabled: boolean;
  /** Service name for traces */
  serviceName: string;
  /** Service version */
  serviceVersion: string;
  /** Deployment environment */
  environment: string;
  /** OTLP endpoint URL */
  endpoint?: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Get telemetry configuration from environment variables.
 */
export function getTelemetryConfig(): TelemetryConfig {
  /* v8 ignore start - environment variable branches */
  return {
    enabled: process.env.OTEL_ENABLED === 'true',
    serviceName: process.env.OTEL_SERVICE_NAME || 'komodo-mcp-server',
    serviceVersion: process.env.npm_package_version || 'unknown',
    environment: process.env.NODE_ENV || 'development',
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    debug: process.env.OTEL_DEBUG === 'true',
  };
  /* v8 ignore stop */
}

let sdk: NodeSDK | null = null;

/**
 * Initialize the OpenTelemetry SDK.
 * Call this at application startup, before any other code.
 *
 * @returns true if OpenTelemetry was initialized
 */
export function initializeTelemetry(): boolean {
  const config = getTelemetryConfig();

  if (!config.enabled) {
    return false;
  }

  // Enable debug logging if requested
  if (config.debug) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  // Create the resource with service information
  const resource = resourceFromAttributes({
    [SEMRESATTRS_SERVICE_NAME]: config.serviceName,
    [SEMRESATTRS_SERVICE_VERSION]: config.serviceVersion,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: config.environment,
  });

  // Configure the OTLP exporter
  const traceExporter = new OTLPTraceExporter({
    url: config.endpoint ? `${config.endpoint}/v1/traces` : undefined,
  });

  // Initialize the SDK with auto-instrumentation
  sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable some noisy instrumentations
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  });

  // Start the SDK
  sdk.start();

  // Graceful shutdown - not testable (process.exit terminates test runner)
  /* v8 ignore start */
  process.on('SIGTERM', () => {
    sdk
      ?.shutdown()
      .then(() => console.error('OpenTelemetry SDK shut down successfully'))
      .catch((err) => console.error('Error shutting down OpenTelemetry SDK', err))
      .finally(() => process.exit(0));
  });
  /* v8 ignore stop */

  console.error(`OpenTelemetry initialized: service=${config.serviceName}, endpoint=${config.endpoint || 'default'}`);
  return true;
}

/**
 * Shutdown the OpenTelemetry SDK.
 * Call this during application shutdown.
 */
export async function shutdownTelemetry(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}
