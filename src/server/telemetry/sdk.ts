/**
 * OpenTelemetry SDK Initialization
 *
 * Handles the lifecycle of the OpenTelemetry SDK including:
 * - SDK initialization with auto-instrumentation
 * - Graceful shutdown
 * - Resource configuration
 *
 * ## Activation
 *
 * Set the following environment variables:
 * - `OTEL_ENABLED=true` - Enable OpenTelemetry
 * - `OTEL_SERVICE_NAME=komodo-mcp-server` - Service name (optional)
 * - `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318` - OTLP endpoint
 *
 * @module server/telemetry/sdk
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { ATTR_DEPLOYMENT_ENVIRONMENT_NAME } from '@opentelemetry/semantic-conventions/incubating';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

import { logger as baseLogger } from '../../utils/logger/logger.js';
import { getTelemetryConfig, TELEMETRY_LOG_COMPONENTS, SdkLogMessages } from './core/index.js';

const logger = baseLogger.child({ component: TELEMETRY_LOG_COMPONENTS.SDK });

/** SDK instance - null when not initialized */
let sdk: NodeSDK | null = null;

/** Flag to track if shutdown handler is registered */
let shutdownHandlerRegistered = false;

/**
 * Initialize the OpenTelemetry SDK.
 * Call this at application startup, before any other code.
 *
 * @returns true if OpenTelemetry was initialized, false if disabled
 *
 * @example
 * ```typescript
 * import { initializeTelemetry } from './telemetry/index.js';
 *
 * // Initialize at startup
 * const enabled = initializeTelemetry();
 * if (enabled) {
 *   console.log('Telemetry enabled');
 * }
 * ```
 */
export function initializeTelemetry(): boolean {
  const config = getTelemetryConfig();

  if (!config.enabled) {
    logger.debug(SdkLogMessages.INIT_SKIPPED);
    return false;
  }

  logger.info(SdkLogMessages.INIT_START);

  // Enable debug logging if requested
  if (config.debug) {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
    logger.debug(SdkLogMessages.INIT_DEBUG_ENABLED);
  }

  // Create the resource with service information
  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: config.serviceName,
    [ATTR_SERVICE_VERSION]: config.serviceVersion,
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: config.environment,
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

  // Register graceful shutdown handler (only once)
  if (!shutdownHandlerRegistered) {
    registerShutdownHandler();
    shutdownHandlerRegistered = true;
  }

  logger.info(SdkLogMessages.INIT_SUCCESS(config.serviceName, config.endpoint || 'default'));
  return true;
}

/**
 * Shutdown the OpenTelemetry SDK.
 * Call this during application shutdown.
 *
 * @returns Promise that resolves when shutdown is complete
 */
export async function shutdownTelemetry(): Promise<void> {
  if (!sdk) {
    logger.debug(SdkLogMessages.SHUTDOWN_SKIPPED);
    return;
  }

  logger.info(SdkLogMessages.SHUTDOWN_START);

  try {
    await sdk.shutdown();
    sdk = null;
    logger.info(SdkLogMessages.SHUTDOWN_SUCCESS);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(SdkLogMessages.SHUTDOWN_ERROR(errorMessage));
    throw error;
  }
}

/**
 * Check if the SDK is currently initialized.
 *
 * @returns true if SDK is initialized
 */
export function isSdkInitialized(): boolean {
  return sdk !== null;
}

/**
 * Register process signal handlers for graceful shutdown.
 * @internal
 */
function registerShutdownHandler(): void {
  /* v8 ignore start - process.exit terminates test runner */
  const handler = async () => {
    try {
      await shutdownTelemetry();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(SdkLogMessages.SHUTDOWN_ERROR(errorMessage));
    }
  };

  process.on('SIGTERM', () => {
    handler().finally(() => process.exit(0));
  });
  /* v8 ignore stop */
}
