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
 *   - 503 Service Unavailable: API configured but not connected
 *   - 429 Too Many Requests: Session limit reached
 *   - Use: Kubernetes readinessProbe, Docker HEALTHCHECK, load balancer health checks
 *
 * For Docker containers, use /ready as the HEALTHCHECK endpoint to ensure
 * the container only receives traffic when fully operational.
 */

import { Router } from 'express';
import type { TransportSessionManager } from '../../session/index.js';
import type { ConnectionStateManager } from '../../connection/index.js';
import type { IApiClient } from '../../types/index.js';
import { getSseSessionCount, isSseEnabled } from '../sse/index.js';
import {
  parseFrameworkEnv,
  SESSION_MAX_COUNT,
  LEGACY_SSE_MAX_SESSIONS,
  type FrameworkEnvConfig,
} from '../../config/index.js';

/** Cached config for performance (lazy initialization) */
let cachedConfig: FrameworkEnvConfig | undefined;

/**
 * Gets or creates cached framework config
 */
function getConfig(): FrameworkEnvConfig {
  if (!cachedConfig) {
    cachedConfig = parseFrameworkEnv();
  }
  return cachedConfig;
}

/**
 * Readiness status codes
 */
enum ReadinessStatus {
  READY = 200,
  SERVICE_UNAVAILABLE = 503,
  TOO_MANY_REQUESTS = 429,
}

/**
 * Options for creating the health router
 */
export interface HealthRouterOptions<TClient extends IApiClient = IApiClient> {
  /** Session manager for tracking active sessions */
  sessionManager: TransportSessionManager;

  /**
   * Optional connection manager for API health checks.
   * If not provided, API connectivity checks are skipped.
   */
  connectionManager?: ConnectionStateManager<TClient>;

  /**
   * Function to check if API is configured.
   * Reads from runtime environment to support Docker env_file.
   * If not provided, defaults to checking for KOMODO_URL env var.
   */
  isApiConfigured?: () => boolean;

  /**
   * Label for the API in health responses (e.g., 'komodo', 'docker', 'kubernetes')
   * Defaults to 'api'
   */
  apiLabel?: string;
}

/**
 * Creates health check router with configurable API connection monitoring.
 *
 * @param options - Configuration options for the health router
 * @returns Express router with /health and /ready endpoints
 *
 * @example
 * ```typescript
 * // Basic usage (no API monitoring)
 * const router = createHealthRouter({ sessionManager });
 *
 * // With Komodo connection monitoring
 * import { komodoConnectionManager } from '../../../app/index.js';
 * const router = createHealthRouter({
 *   sessionManager,
 *   connectionManager: komodoConnectionManager,
 *   isApiConfigured: () => !!process.env.KOMODO_URL,
 *   apiLabel: 'komodo',
 * });
 * ```
 */
export function createHealthRouter<TClient extends IApiClient = IApiClient>(
  options: HealthRouterOptions<TClient>,
): Router {
  const {
    sessionManager,
    connectionManager,
    isApiConfigured = () => !!process.env.KOMODO_URL?.trim(),
    apiLabel = 'api',
  } = options;

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
    const config = getConfig();
    const response: Record<string, unknown> = {
      status: 'healthy',
      version: config.VERSION,
      uptime: process.uptime(),
      sessions: {
        streamableHttp: sessionManager.size,
      },
    };

    // Include SSE session count if enabled
    if (isSseEnabled()) {
      (response.sessions as Record<string, number>).sse = getSseSessionCount();
    }

    res.status(200).json(response);
  });

  /**
   * Readiness probe endpoint
   * Returns appropriate status code based on server readiness.
   *
   * Status codes:
   * - 200 OK: Server is ready to accept traffic
   * - 503 Service Unavailable: API is configured but not connected
   * - 429 Too Many Requests: Session limits reached (server is overloaded)
   *
   * Used by:
   * - Kubernetes readinessProbe to determine if traffic should be routed
   * - Docker HEALTHCHECK to determine container health
   * - Load balancers to determine backend availability
   */
  router.get('/ready', (_req, res) => {
    const config = getConfig();

    // Get API connection state (if connection manager is provided)
    const connectionState = connectionManager?.getState() ?? 'unknown';
    const isApiConnected = connectionState === 'connected';

    // Check session limits
    const httpSessionCount = sessionManager.size;
    const sseSessionCount = isSseEnabled() ? getSseSessionCount() : 0;
    const httpSessionsAtLimit = httpSessionCount >= SESSION_MAX_COUNT;
    const sseSessionsAtLimit = isSseEnabled() && sseSessionCount >= LEGACY_SSE_MAX_SESSIONS;
    const sessionsAtLimit = httpSessionsAtLimit || sseSessionsAtLimit;

    // Determine readiness
    const hasApiConfig = isApiConfigured();
    // If API is configured, we require connection; if not configured, we're ready
    const apiReady = !hasApiConfig || isApiConnected;

    // Determine status code
    let status: ReadinessStatus;
    let reason: string;

    if (sessionsAtLimit) {
      status = ReadinessStatus.TOO_MANY_REQUESTS;
      reason = httpSessionsAtLimit
        ? `HTTP session limit reached (${httpSessionCount}/${SESSION_MAX_COUNT})`
        : `SSE session limit reached (${sseSessionCount}/${LEGACY_SSE_MAX_SESSIONS})`;
    } else if (!apiReady) {
      status = ReadinessStatus.SERVICE_UNAVAILABLE;
      reason = `${apiLabel} not connected (state: ${connectionState})`;
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
      [apiLabel]: {
        configured: hasApiConfig,
        state: connectionState,
        connected: isApiConnected,
      },
      sessions: {
        streamableHttp: {
          current: httpSessionCount,
          max: SESSION_MAX_COUNT,
          atLimit: httpSessionsAtLimit,
        },
        ...(isSseEnabled() && {
          sse: {
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
