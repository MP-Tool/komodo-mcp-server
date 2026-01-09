/**
 * Health and Readiness check routes
 *
 * Provides endpoints for container orchestration (Kubernetes, Docker Swarm, Docker Compose):
 *
 * /health - Liveness probe (is the process alive?)
 *   - Always returns 200 if server is running
 *   - Use: Kubernetes livenessProbe, basic uptime monitoring
 *
 * /ready - Readiness probe (can the server handle requests?)
 *   - 200 OK: Server is ready for traffic
 *   - 503 Service Unavailable: Komodo configured but not connected
 *   - 429 Too Many Requests: Session limit reached
 *   - Use: Kubernetes readinessProbe, Docker HEALTHCHECK, load balancer health checks
 *
 * For Docker containers, use /ready as the HEALTHCHECK endpoint to ensure
 * the container only receives traffic when fully operational.
 */

import { Router } from 'express';
import { config, getKomodoCredentials } from '../../config/index.js';
import type { TransportSessionManager } from '../session-manager.js';
import { getLegacySseSessionCount, isLegacySseEnabled } from './mcp.js';
import { connectionManager } from '../../utils/index.js';
import { SESSION_MAX_COUNT, LEGACY_SSE_MAX_SESSIONS } from '../../config/transport.config.js';

/**
 * Readiness status codes
 */
enum ReadinessStatus {
  READY = 200,
  SERVICE_UNAVAILABLE = 503,
  TOO_MANY_REQUESTS = 429,
}

export function createHealthRouter(sessionManager: TransportSessionManager): Router {
  const router = Router();

  /**
   * Liveness probe endpoint
   * Returns 200 if the server process is running.
   * Used by Kubernetes to determine if the container should be restarted.
   *
   * This endpoint should ALWAYS return 200 as long as the process is alive.
   * Do not add dependency checks here - use /ready for that.
   */
  router.get('/health', (_req, res) => {
    const response: Record<string, unknown> = {
      status: 'healthy',
      version: config.VERSION,
      uptime: process.uptime(),
      sessions: {
        streamableHttp: sessionManager.size,
      },
    };

    // Include Legacy SSE session count if enabled
    if (isLegacySseEnabled()) {
      (response.sessions as Record<string, number>).legacySse = getLegacySseSessionCount();
    }

    res.status(200).json(response);
  });

  /**
   * Readiness probe endpoint
   * Returns appropriate status code based on server readiness.
   *
   * Status codes:
   * - 200 OK: Server is ready to accept traffic
   * - 503 Service Unavailable: Komodo is configured but not connected
   * - 429 Too Many Requests: Session limits reached (server is overloaded)
   *
   * Used by:
   * - Kubernetes readinessProbe to determine if traffic should be routed
   * - Docker HEALTHCHECK to determine container health
   * - Load balancers to determine backend availability
   */
  router.get('/ready', (_req, res) => {
    const connectionState = connectionManager.getState();
    const isKomodoConnected = connectionState === 'connected';

    // Check session limits
    const httpSessionCount = sessionManager.size;
    const sseSessionCount = isLegacySseEnabled() ? getLegacySseSessionCount() : 0;
    const httpSessionsAtLimit = httpSessionCount >= SESSION_MAX_COUNT;
    const sseSessionsAtLimit = isLegacySseEnabled() && sseSessionCount >= LEGACY_SSE_MAX_SESSIONS;
    const sessionsAtLimit = httpSessionsAtLimit || sseSessionsAtLimit;

    // Determine readiness
    // Use getKomodoCredentials() for runtime env access (Docker env_file support)
    const hasKomodoConfig = !!getKomodoCredentials().url;
    const komodoReady = !hasKomodoConfig || isKomodoConnected;

    // Determine status code
    let status: ReadinessStatus;
    let reason: string;

    if (sessionsAtLimit) {
      status = ReadinessStatus.TOO_MANY_REQUESTS;
      reason = httpSessionsAtLimit
        ? `HTTP session limit reached (${httpSessionCount}/${SESSION_MAX_COUNT})`
        : `SSE session limit reached (${sseSessionCount}/${LEGACY_SSE_MAX_SESSIONS})`;
    } else if (!komodoReady) {
      status = ReadinessStatus.SERVICE_UNAVAILABLE;
      reason = `Komodo not connected (state: ${connectionState})`;
    } else {
      status = ReadinessStatus.READY;
      reason = 'Server is ready';
    }

    const isReady = status === ReadinessStatus.READY;

    const response = {
      ready: isReady,
      status: reason,
      version: config.VERSION,
      uptime: process.uptime(),
      komodo: {
        configured: hasKomodoConfig,
        state: connectionState,
        connected: isKomodoConnected,
      },
      sessions: {
        streamableHttp: {
          current: httpSessionCount,
          max: SESSION_MAX_COUNT,
          atLimit: httpSessionsAtLimit,
        },
        ...(isLegacySseEnabled() && {
          legacySse: {
            current: sseSessionCount,
            max: LEGACY_SSE_MAX_SESSIONS,
            atLimit: sseSessionsAtLimit,
          },
        }),
      },
    };

    res.status(status).json(response);
  });

  return router;
}
