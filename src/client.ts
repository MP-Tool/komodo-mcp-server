/**
 * Komodo Client
 *
 * Thin wrapper around komodo_client providing ServiceClient interface
 * for framework compatibility and ConnectionStateManager integration.
 *
 * @module client
 */

import { KomodoClient as createKomodoClient } from "komodo_client";
import {
  ConnectionStateManager,
  logger as baseLogger,
  type ServiceClient,
  type HealthCheckResult,
} from "mcp-server-framework";
import { AuthenticationError, ConnectionError } from "./errors/index.js";
import { config, getKomodoCredentials, type KomodoCredentials } from "./config/index.js";

const logger = baseLogger.child({ component: "KomodoClient" });

// ============================================================================
// Error Extraction
// ============================================================================

/**
 * Formats an Error, including its cause chain for network errors.
 * Node.js fetch wraps the real cause (ECONNREFUSED, ENOTFOUND, etc.) in error.cause.
 */
export function formatError(error: Error): string {
  const cause = "cause" in error && error.cause instanceof Error ? error.cause : null;
  return cause ? `${error.message}: ${cause.message}` : error.message;
}

/**
 * Extracts a readable error message from a komodo_client rejection.
 * The library rejects with plain objects: { status, result: { error, trace? }, error? }
 */
export function extractKomodoError(error: unknown): string {
  if (error instanceof Error) return formatError(error);
  if (typeof error === "object" && error !== null) {
    const e = error as Record<string, unknown>;
    // Network error has .error as an Error instance
    if (e.error instanceof Error) return formatError(e.error);
    // HTTP error has .result.error as a string
    if (typeof e.result === "object" && e.result !== null) {
      const result = e.result as Record<string, unknown>;
      if (typeof result.error === "string") return result.error;
    }
    if (typeof e.status === "number") return `HTTP ${e.status}`;
  }
  return String(error);
}

// ============================================================================
// Client Type
// ============================================================================

/** The raw komodo_client instance type */
type RawKomodoClient = ReturnType<typeof createKomodoClient>;

// ============================================================================
// Komodo Client
// ============================================================================

export class KomodoClient implements ServiceClient {
  readonly clientType = "komodo" as const;
  readonly client: RawKomodoClient;
  private readonly baseUrl: string;

  private constructor(baseUrl: string, client: RawKomodoClient) {
    this.baseUrl = baseUrl;
    this.client = client;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Login with username/password.
   */
  static async login(baseUrl: string, username: string, password: string): Promise<KomodoClient> {
    const url = baseUrl.replace(/\/$/, "");
    const timeoutMs = config.API_TIMEOUT_MS;

    logger.trace('Authenticating as "%s" at %s', username, url);

    // Temporary client — empty jwt is falsy, so no authorization header is sent
    const tempClient = createKomodoClient(url, { type: "jwt", params: { jwt: "" } });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(ConnectionError.timeout(url)), timeoutMs),
    );

    try {
      const result = await Promise.race([tempClient.auth("LoginLocalUser", { username, password }), timeoutPromise]);

      if (!result.jwt) throw AuthenticationError.noToken();

      const client = createKomodoClient(url, { type: "jwt", params: { jwt: result.jwt } });
      logger.info("Successfully authenticated to %s", url);
      return new KomodoClient(url, client);
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof ConnectionError) throw error;
      // Detect 401/403 auth failures from komodo_client plain object rejections
      const komodoErr = error as Record<string, unknown>;
      if (komodoErr.status === 401 || komodoErr.status === 403) {
        throw AuthenticationError.invalidCredentials();
      }
      throw ConnectionError.failed(url, extractKomodoError(error));
    }
  }

  /**
   * Connect with API key/secret.
   */
  static connectWithApiKey(baseUrl: string, key: string, secret: string): KomodoClient {
    const url = baseUrl.replace(/\/$/, "");
    logger.trace("Connecting with API-Key to %s", url);
    const client = createKomodoClient(url, { type: "api-key", params: { key, secret } });
    logger.info("Connected with API key to %s", url);
    return new KomodoClient(url, client);
  }

  /**
   * Health check for ConnectionStateManager.
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const versionRes = await this.client.read("GetVersion", {});
      return {
        status: "healthy",
        message: "Connected",
        details: {
          url: this.baseUrl,
          reachable: true,
          authenticated: true,
          responseTime: Date.now() - startTime,
          apiVersion: versionRes.version,
        },
      };
    } catch (error) {
      const errorMessage = extractKomodoError(error);
      return {
        status: "unhealthy",
        message: errorMessage,
        details: {
          url: this.baseUrl,
          reachable: false,
          authenticated: false,
          responseTime: Date.now() - startTime,
          error: errorMessage,
        },
      };
    }
  }
}

// ============================================================================
// Connection Manager Singleton
// ============================================================================

export const komodoConnectionManager = new ConnectionStateManager<KomodoClient>();

// ============================================================================
// Connection Monitor (auto-reconnect)
// ============================================================================

/**
 * Periodic health check + automatic reconnection for the Komodo API.
 *
 * Stores the last used credentials and re-authenticates on connection loss
 * (re-login for JWT, fresh client for API key). Uses exponential backoff
 * to avoid hammering a restarting Komodo Core.
 */
class KomodoConnectionMonitor {
  private credentials: KomodoCredentials | null = null;
  private timer: NodeJS.Timeout | null = null;
  private retryDelay = 5_000;
  private readonly maxDelay = 60_000;
  private readonly checkIntervalMs: number;

  constructor(checkIntervalMs = 30_000) {
    this.checkIntervalMs = checkIntervalMs;
  }

  /** Start monitoring with the given credentials. Stops any previous monitor. */
  start(credentials: KomodoCredentials): void {
    this.stop();
    this.credentials = credentials;
    this.retryDelay = 5_000;
    this.scheduleHealthCheck();
    logger.trace("Connection monitor started (interval: %dms)", this.checkIntervalMs);
  }

  /** Stop monitoring and clear stored credentials. */
  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.credentials = null;
  }

  private scheduleHealthCheck(): void {
    this.timer = setTimeout(() => void this.runHealthCheck(), this.checkIntervalMs);
  }

  private scheduleReconnect(): void {
    logger.debug("Komodo connection lost. Trying to reconnect in %dms", this.retryDelay);
    this.timer = setTimeout(() => void this.attemptReconnect(), this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, this.maxDelay);
  }

  private async runHealthCheck(): Promise<void> {
    const client = komodoConnectionManager.getClient();
    if (!client) {
      this.scheduleHealthCheck();
      return;
    }

    const health = await client.healthCheck();
    if (health.status === "healthy") {
      this.retryDelay = 5_000;
      this.scheduleHealthCheck();
    } else {
      logger.warn("Komodo health check failed: %s — initiating reconnect", health.message);
      this.scheduleReconnect();
    }
  }

  private async attemptReconnect(): Promise<void> {
    const creds = this.credentials;
    if (!creds?.url) {
      this.scheduleHealthCheck();
      return;
    }

    logger.debug("Attempting Komodo reconnection to %s...", creds.url);

    try {
      let client: KomodoClient;

      if (creds.apiKey && creds.apiSecret) {
        client = KomodoClient.connectWithApiKey(creds.url, creds.apiKey, creds.apiSecret);
      } else if (creds.username && creds.password) {
        client = await KomodoClient.login(creds.url, creds.username, creds.password);
      } else {
        logger.error("No credentials available for reconnect");
        this.scheduleHealthCheck();
        return;
      }

      const success = await komodoConnectionManager.connect(client);

      if (success) {
        logger.info("Komodo reconnection successful");
        this.retryDelay = 5_000;
        this.scheduleHealthCheck();
      } else {
        logger.debug("Reconnection failed: health check unsuccessful");
        this.scheduleReconnect();
      }
    } catch (error) {
      logger.trace("Reconnection attempt failed: %s", error instanceof Error ? error.message : String(error));
      this.scheduleReconnect();
    }
  }
}

export const komodoConnectionMonitor = new KomodoConnectionMonitor();

// ============================================================================
// Auto-Init from Environment
// ============================================================================

/**
 * Attempts to initialize the Komodo client from environment variables.
 * Called as onStarting lifecycle hook.
 */
export async function initializeKomodoClientFromEnv(): Promise<void> {
  const creds = getKomodoCredentials();

  if (!creds.url) {
    logger.info("No KOMODO_URL configured - use komodo_configure tool to connect");
    return;
  }

  logger.debug(
    "Komodo credentials: url=%s, auth=%s",
    creds.url,
    creds.apiKey ? "api-key" : creds.username ? "username/password" : "none",
  );

  try {
    let client: KomodoClient;

    if (creds.apiKey && creds.apiSecret) {
      logger.debug("Connecting to Komodo at %s (api-key)...", creds.url);
      client = KomodoClient.connectWithApiKey(creds.url, creds.apiKey, creds.apiSecret);
    } else if (creds.username && creds.password) {
      logger.debug("Connecting to Komodo at %s (login)...", creds.url);
      client = await KomodoClient.login(creds.url, creds.username, creds.password);
    } else {
      logger.info("No Komodo credentials configured - use komodo_configure tool to connect");
      return;
    }

    const success = await komodoConnectionManager.connect(client);

    if (success) {
      logger.info("Komodo connection established");
      komodoConnectionMonitor.start(creds);
    } else {
      logger.warn("Komodo connection failed: health check unsuccessful");
    }
  } catch (error) {
    logger.warn("Komodo connection failed: %s", error instanceof Error ? error.message : String(error));
  }
}
