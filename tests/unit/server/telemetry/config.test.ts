/**
 * Tests for Telemetry Core Config Module
 *
 * Tests the configuration wrapper functions:
 * - getTelemetryConfig
 * - isTelemetryEnabled
 *
 * Note: The actual environment parsing is tested in config/env.test.ts.
 * These tests verify the wrapper functions return correct structure from centralized config.
 */

import { describe, it, expect } from 'vitest';
import { getTelemetryConfig, isTelemetryEnabled } from '../../../../src/server/telemetry/core/config.js';
import { config } from '../../../../src/config/index.js';

describe('Telemetry Core Config', () => {
  describe('getTelemetryConfig', () => {
    it('should return a TelemetryConfig object with all required properties', () => {
      const telemetryConfig = getTelemetryConfig();

      // Verify structure
      expect(telemetryConfig).toHaveProperty('enabled');
      expect(telemetryConfig).toHaveProperty('serviceName');
      expect(telemetryConfig).toHaveProperty('serviceVersion');
      expect(telemetryConfig).toHaveProperty('environment');
      expect(telemetryConfig).toHaveProperty('endpoint');
      expect(telemetryConfig).toHaveProperty('debug');
    });

    it('should return values from centralized config', () => {
      const telemetryConfig = getTelemetryConfig();

      // Verify values match central config
      expect(telemetryConfig.enabled).toBe(config.OTEL_ENABLED);
      expect(telemetryConfig.serviceName).toBe(config.OTEL_SERVICE_NAME);
      expect(telemetryConfig.serviceVersion).toBe(config.VERSION);
      expect(telemetryConfig.environment).toBe(config.NODE_ENV);
      expect(telemetryConfig.endpoint).toBe(config.OTEL_EXPORTER_OTLP_ENDPOINT);
      expect(telemetryConfig.debug).toBe(config.OTEL_DEBUG);
    });

    it('should return correct types for all properties', () => {
      const telemetryConfig = getTelemetryConfig();

      expect(typeof telemetryConfig.enabled).toBe('boolean');
      expect(typeof telemetryConfig.serviceName).toBe('string');
      expect(typeof telemetryConfig.serviceVersion).toBe('string');
      expect(typeof telemetryConfig.environment).toBe('string');
      expect(telemetryConfig.endpoint === undefined || typeof telemetryConfig.endpoint === 'string').toBe(true);
      expect(typeof telemetryConfig.debug).toBe('boolean');
    });

    it('should return consistent values on multiple calls', () => {
      const config1 = getTelemetryConfig();
      const config2 = getTelemetryConfig();

      expect(config1).toEqual(config2);
    });
  });

  describe('isTelemetryEnabled', () => {
    it('should return a boolean', () => {
      expect(typeof isTelemetryEnabled()).toBe('boolean');
    });

    it('should return the same value as config.OTEL_ENABLED', () => {
      expect(isTelemetryEnabled()).toBe(config.OTEL_ENABLED);
    });

    it('should return consistent values on multiple calls', () => {
      expect(isTelemetryEnabled()).toBe(isTelemetryEnabled());
    });
  });
});
