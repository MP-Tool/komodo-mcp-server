/**
 * Telemetry Configuration
 *
 * Reads telemetry configuration from environment variables.
 * Provides type-safe access to OpenTelemetry settings.
 *
 * @module server/telemetry/core/config
 */

import type { TelemetryConfig } from './types.js';
import { TELEMETRY_DEFAULTS, TELEMETRY_ENV_VARS } from './constants.js';
import { parseEnvBoolean } from '../../../utils/env-helpers.js';

/**
 * Get telemetry configuration from environment variables.
 *
 * Reads the following environment variables:
 * - `OTEL_ENABLED` - Enable OpenTelemetry (default: false)
 * - `OTEL_SERVICE_NAME` - Service name (default: 'komodo-mcp-server')
 * - `OTEL_EXPORTER_OTLP_ENDPOINT` - OTLP endpoint URL
 * - `OTEL_DEBUG` - Enable debug logging (default: false)
 * - `NODE_ENV` - Environment name (default: 'development')
 *
 * @returns Telemetry configuration object
 */
export function getTelemetryConfig(): TelemetryConfig {
  /* v8 ignore start - environment variable branches */
  return {
    enabled: parseEnvBoolean(process.env[TELEMETRY_ENV_VARS.OTEL_ENABLED]),
    serviceName: process.env[TELEMETRY_ENV_VARS.OTEL_SERVICE_NAME] || TELEMETRY_DEFAULTS.SERVICE_NAME,
    serviceVersion: process.env[TELEMETRY_ENV_VARS.NPM_PACKAGE_VERSION] || TELEMETRY_DEFAULTS.SERVICE_VERSION_FALLBACK,
    environment: process.env[TELEMETRY_ENV_VARS.NODE_ENV] || TELEMETRY_DEFAULTS.ENVIRONMENT_FALLBACK,
    endpoint: process.env[TELEMETRY_ENV_VARS.OTEL_EXPORTER_OTLP_ENDPOINT],
    debug: parseEnvBoolean(process.env[TELEMETRY_ENV_VARS.OTEL_DEBUG]),
  };
  /* v8 ignore stop */
}

/**
 * Check if OpenTelemetry is enabled.
 *
 * @returns true if OTEL_ENABLED=true
 */
export function isTelemetryEnabled(): boolean {
  return parseEnvBoolean(process.env[TELEMETRY_ENV_VARS.OTEL_ENABLED]);
}
