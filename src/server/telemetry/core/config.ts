/**
 * Telemetry Configuration
 *
 * Provides type-safe access to OpenTelemetry settings from the central config.
 * Delegates to the application's centralized environment configuration.
 *
 * @module server/telemetry/core/config
 */

import type { TelemetryConfig } from './types.js';
import { config } from '../../../app/config/index.js';

/**
 * Get telemetry configuration from centralized application config.
 *
 * Uses the following environment variables (parsed in config/env.ts):
 * - `OTEL_ENABLED` - Enable OpenTelemetry (default: false)
 * - `OTEL_SERVICE_NAME` - Service name (default: 'komodo-mcp-server')
 * - `OTEL_EXPORTER_OTLP_ENDPOINT` - OTLP endpoint URL
 * - `OTEL_DEBUG` - Enable debug logging (default: false)
 * - `NODE_ENV` - Environment name (default: 'development')
 *
 * @returns Telemetry configuration object
 */
export function getTelemetryConfig(): TelemetryConfig {
  return {
    enabled: config.OTEL_ENABLED,
    serviceName: config.OTEL_SERVICE_NAME,
    serviceVersion: config.VERSION,
    environment: config.NODE_ENV,
    endpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
    debug: config.OTEL_DEBUG,
  };
}

/**
 * Check if OpenTelemetry is enabled.
 *
 * @returns true if OTEL_ENABLED=true
 */
export function isTelemetryEnabled(): boolean {
  return config.OTEL_ENABLED;
}
