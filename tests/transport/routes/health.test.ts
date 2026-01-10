/**
 * Health Routes Tests
 *
 * Tests for /health (liveness) and /ready (readiness) endpoints.
 * These endpoints are used by container orchestrators like Kubernetes and Docker.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createHealthRouter } from '../../../src/transport/routes/health.js';
import type { TransportSessionManager } from '../../../src/transport/session-manager.js';

// Mock dependencies
vi.mock('../../../src/config/env.js', () => ({
  config: {
    VERSION: '1.0.0-test',
    KOMODO_URL: undefined,
    MCP_LEGACY_SSE_ENABLED: false,
  },
}));

vi.mock('../../../src/config/transport.config.js', () => ({
  SESSION_MAX_COUNT: 100,
  LEGACY_SSE_MAX_SESSIONS: 50,
}));

// Create mock implementations that can be changed per test
let mockLegacySseEnabled = false;
let mockLegacySseCount = 0;
let mockConnectionState: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
let mockSessionCount = 5;

vi.mock('../../../src/transport/routes/mcp.js', () => ({
  isLegacySseEnabled: () => mockLegacySseEnabled,
  getLegacySseSessionCount: () => mockLegacySseCount,
}));

// Mock connectionManager to control state directly
vi.mock('../../../src/utils/connection-state.js', () => ({
  connectionManager: {
    getState: () => mockConnectionState,
  },
}));

describe('Health Routes', () => {
  let app: express.Application;
  let mockSessionManager: Partial<TransportSessionManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLegacySseEnabled = false;
    mockLegacySseCount = 0;
    mockConnectionState = 'disconnected';
    mockSessionCount = 5;

    mockSessionManager = {
      get size() {
        return mockSessionCount;
      },
    };

    app = express();
    app.use(createHealthRouter(mockSessionManager as TransportSessionManager));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.KOMODO_URL;
  });

  describe('GET /health (Liveness Probe)', () => {
    it('should return healthy status with uptime', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        status: 'healthy',
        version: '1.0.0-test',
        sessions: {
          streamableHttp: 5,
        },
      });
      expect(response.body.uptime).toBeTypeOf('number');
    });

    it('should include Legacy SSE session count when enabled', async () => {
      mockLegacySseEnabled = true;
      mockLegacySseCount = 3;

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.sessions).toMatchObject({
        streamableHttp: 5,
        legacySse: 3,
      });
    });

    it('should not include Legacy SSE session count when disabled', async () => {
      mockLegacySseEnabled = false;

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.sessions).not.toHaveProperty('legacySse');
    });
  });

  describe('GET /ready (Readiness Probe)', () => {
    it('should return 200 OK when no Komodo URL is configured (standalone mode)', async () => {
      const response = await request(app).get('/ready');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        ready: true,
        status: 'Server is ready',
        version: '1.0.0-test',
        komodo: {
          configured: false,
          state: 'disconnected',
          connected: false,
        },
      });
      expect(response.body.uptime).toBeTypeOf('number');
    });

    it('should return 503 Service Unavailable when Komodo is configured but disconnected', async () => {
      process.env.KOMODO_URL = 'http://localhost:9120';

      const response = await request(app).get('/ready');

      expect(response.status).toBe(503);
      expect(response.body).toMatchObject({
        ready: false,
        status: 'Komodo not connected (state: disconnected)',
        komodo: {
          configured: true,
          state: 'disconnected',
          connected: false,
        },
      });
    });

    it('should return 200 OK when Komodo is configured and connected', async () => {
      process.env.KOMODO_URL = 'http://localhost:9120';
      mockConnectionState = 'connected';

      const response = await request(app).get('/ready');

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        ready: true,
        status: 'Server is ready',
        komodo: {
          configured: true,
          state: 'connected',
          connected: true,
        },
      });
    });

    it('should return 429 Too Many Requests when HTTP session limit reached', async () => {
      mockSessionCount = 100; // At limit (SESSION_MAX_COUNT)

      const response = await request(app).get('/ready');

      expect(response.status).toBe(429);
      expect(response.body).toMatchObject({
        ready: false,
        status: 'HTTP session limit reached (100/100)',
        sessions: {
          streamableHttp: {
            current: 100,
            max: 100,
            atLimit: true,
          },
        },
      });
    });

    it('should return 429 Too Many Requests when Legacy SSE session limit reached', async () => {
      mockLegacySseEnabled = true;
      mockLegacySseCount = 50; // At limit (LEGACY_SSE_MAX_SESSIONS)

      const response = await request(app).get('/ready');

      expect(response.status).toBe(429);
      expect(response.body).toMatchObject({
        ready: false,
        status: 'SSE session limit reached (50/50)',
        sessions: {
          streamableHttp: {
            current: 5,
            max: 100,
            atLimit: false,
          },
          legacySse: {
            current: 50,
            max: 50,
            atLimit: true,
          },
        },
      });
    });

    it('should include detailed session information in response', async () => {
      mockLegacySseEnabled = true;
      mockLegacySseCount = 10;
      mockSessionCount = 25;

      const response = await request(app).get('/ready');

      expect(response.status).toBe(200);
      expect(response.body.sessions).toMatchObject({
        streamableHttp: {
          current: 25,
          max: 100,
          atLimit: false,
        },
        legacySse: {
          current: 10,
          max: 50,
          atLimit: false,
        },
      });
    });

    it('should prioritize 429 over 503 (session limit takes precedence)', async () => {
      process.env.KOMODO_URL = 'http://localhost:9120';
      mockConnectionState = 'disconnected';
      mockSessionCount = 100; // At limit

      const response = await request(app).get('/ready');

      // 429 should take precedence over 503
      expect(response.status).toBe(429);
      expect(response.body.ready).toBe(false);
    });
  });
});
