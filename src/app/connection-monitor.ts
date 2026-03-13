/**
 * Connection Health Monitor
 *
 * Periodically checks the health of the Komodo Core connection and
 * automatically attempts reconnection when the upstream server becomes
 * unreachable (e.g., after a restart or network disruption).
 *
 * Without this monitor, a Komodo Core restart leaves all MCP tools
 * unavailable until someone manually calls `komodo_configure`.
 *
 * @module app/connection-monitor
 */

import { KomodoClient } from './api/index.js';
import { getKomodoCredentials } from './config/index.js';
import { logger as baseLogger } from './framework.js';
import { komodoConnectionManager } from './connection.js';

const logger = baseLogger.child({ component: 'ConnectionMonitor' });

/**
 * Configuration for the connection health monitor.
 */
export interface ConnectionMonitorConfig {
  /** Interval between health checks in milliseconds (default: 30000 = 30s) */
  healthCheckIntervalMs: number;
  /** Initial delay before first reconnection attempt in milliseconds (default: 2000) */
  reconnectBaseDelayMs: number;
  /** Maximum delay between reconnection attempts in milliseconds (default: 60000) */
  reconnectMaxDelayMs: number;
  /** Maximum number of consecutive reconnection failures before backing off to health-check-only mode (default: 10) */
  maxReconnectAttempts: number;
}

const DEFAULT_CONFIG: ConnectionMonitorConfig = {
  healthCheckIntervalMs: 30_000,
  reconnectBaseDelayMs: 2_000,
  reconnectMaxDelayMs: 60_000,
  maxReconnectAttempts: 10,
};

/**
 * Parses connection monitor configuration from environment variables.
 */
function getConfigFromEnv(): ConnectionMonitorConfig {
  const parseIntEnv = (key: string, fallback: number): number => {
    const val = process.env[key];
    if (val) {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return fallback;
  };

  return {
    healthCheckIntervalMs: parseIntEnv('CONNECTION_MONITOR_INTERVAL_MS', DEFAULT_CONFIG.healthCheckIntervalMs),
    reconnectBaseDelayMs: parseIntEnv('CONNECTION_MONITOR_RECONNECT_BASE_MS', DEFAULT_CONFIG.reconnectBaseDelayMs),
    reconnectMaxDelayMs: parseIntEnv('CONNECTION_MONITOR_RECONNECT_MAX_MS', DEFAULT_CONFIG.reconnectMaxDelayMs),
    maxReconnectAttempts: parseIntEnv('CONNECTION_MONITOR_MAX_RECONNECT_ATTEMPTS', DEFAULT_CONFIG.maxReconnectAttempts),
  };
}

/**
 * Connection health monitor that runs periodic health checks and
 * automatically reconnects to Komodo Core when the connection drops.
 *
 * Lifecycle:
 * 1. Periodically calls `healthCheck()` on the current client
 * 2. If the check fails, transitions state to 'error'
 * 3. Attempts reconnection using stored environment credentials
 * 4. Uses exponential backoff between retry attempts
 * 5. On success, `connectionManager.connect()` fires state listeners
 *    which notify all MCP clients via `toolListChanged`
 */
class ConnectionMonitor {
  private healthCheckTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private config: ConnectionMonitorConfig;
  private consecutiveFailures = 0;
  private isReconnecting = false;
  private running = false;

  constructor(config?: Partial<ConnectionMonitorConfig>) {
    this.config = { ...getConfigFromEnv(), ...config };
  }

  /**
   * Start the health monitor.
   * Only starts if the connection is currently established.
   */
  start(): void {
    if (this.running) {
      logger.debug('Monitor already running');
      return;
    }

    if (!komodoConnectionManager.isConnected()) {
      logger.debug('Not connected — monitor will not start (no credentials to reconnect with)');
      return;
    }

    this.running = true;
    this.consecutiveFailures = 0;

    logger.info(
      'Starting connection monitor (interval=%dms, maxRetries=%d)',
      this.config.healthCheckIntervalMs,
      this.config.maxReconnectAttempts,
    );

    this.healthCheckTimer = setInterval(() => {
      void this.performHealthCheck();
    }, this.config.healthCheckIntervalMs);
  }

  /**
   * Stop the health monitor and cancel any pending reconnection.
   */
  stop(): void {
    if (!this.running) return;

    this.running = false;

    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.isReconnecting = false;
    logger.info('Connection monitor stopped');
  }

  /**
   * Check if the monitor is currently running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Perform a single health check against the connected client.
   */
  private async performHealthCheck(): Promise<void> {
    // Skip if already attempting reconnection
    if (this.isReconnecting) return;

    const client = komodoConnectionManager.getClient();
    if (!client) {
      // No client — attempt reconnection
      logger.debug('No client available, attempting reconnection');
      void this.attemptReconnect();
      return;
    }

    try {
      const result = await client.healthCheck();

      if (result.status === 'healthy') {
        // Reset failure counter on success
        if (this.consecutiveFailures > 0) {
          logger.info('Connection restored after %d failed checks', this.consecutiveFailures);
          this.consecutiveFailures = 0;
        }
        return;
      }

      // Health check returned unhealthy
      this.consecutiveFailures++;
      logger.warn(
        'Health check failed (attempt %d): %s',
        this.consecutiveFailures,
        result.message,
      );

      // Transition to error state
      komodoConnectionManager.setError(new Error(`Health check failed: ${result.message}`));

      // Attempt reconnection
      void this.attemptReconnect();
    } catch (error) {
      this.consecutiveFailures++;
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Health check error (attempt %d): %s', this.consecutiveFailures, message);

      komodoConnectionManager.setError(
        error instanceof Error ? error : new Error(message),
      );

      void this.attemptReconnect();
    }
  }

  /**
   * Attempt to reconnect to Komodo Core using environment credentials.
   * Uses exponential backoff with jitter between attempts.
   */
  private async attemptReconnect(): Promise<void> {
    if (this.isReconnecting) return;

    // Check if we've exceeded max attempts — back off to monitoring only
    if (this.consecutiveFailures > this.config.maxReconnectAttempts) {
      if (this.consecutiveFailures === this.config.maxReconnectAttempts + 1) {
        logger.warn(
          'Max reconnection attempts (%d) exceeded — backing off to health-check-only mode. ' +
            'Will resume reconnection attempts if a health check succeeds.',
          this.config.maxReconnectAttempts,
        );
      }
      return;
    }

    this.isReconnecting = true;

    // Calculate delay with exponential backoff + jitter
    const exponentialDelay = Math.min(
      this.config.reconnectBaseDelayMs * Math.pow(2, this.consecutiveFailures - 1),
      this.config.reconnectMaxDelayMs,
    );
    const jitter = exponentialDelay * 0.2 * Math.random();
    const delay = Math.round(exponentialDelay + jitter);

    logger.info('Attempting reconnection in %dms (attempt %d)', delay, this.consecutiveFailures);

    // Wait before reconnecting
    await new Promise<void>((resolve) => {
      this.reconnectTimer = setTimeout(resolve, delay);
    });

    // Abort if monitor was stopped during wait
    if (!this.running) {
      this.isReconnecting = false;
      return;
    }

    try {
      const creds = getKomodoCredentials();

      if (!creds.url) {
        logger.warn('Cannot reconnect: no KOMODO_URL configured');
        this.isReconnecting = false;
        return;
      }

      let client: KomodoClient;

      if (creds.apiKey && creds.apiSecret) {
        client = KomodoClient.connectWithApiKey(creds.url, creds.apiKey, creds.apiSecret);
      } else if (creds.username && creds.password) {
        client = await KomodoClient.login(creds.url, creds.username, creds.password);
      } else {
        logger.warn('Cannot reconnect: no credentials available');
        this.isReconnecting = false;
        return;
      }

      // Attempt connection with health check validation
      const success = await komodoConnectionManager.connect(client);

      if (success) {
        logger.info('✅ Reconnection successful — tools restored');
        this.consecutiveFailures = 0;
      } else {
        logger.warn('Reconnection health check failed — will retry');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Reconnection attempt failed: %s', message);
    } finally {
      this.isReconnecting = false;
    }
  }
}

/**
 * Singleton connection monitor instance.
 */
export const connectionMonitor = new ConnectionMonitor();
