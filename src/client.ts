/**
 * Komodo Client
 *
 * Thin wrapper around komodo_client with local connection tracking,
 * Auth Strategy Pattern, and automatic reconnection.
 *
 * @module client
 */

import { KomodoClient as createKomodoClient } from "komodo_client";
import { logger as baseLogger } from "mcp-server-framework";
import {
  AuthenticationError,
  ConnectionError,
  extractKomodoError,
  formatError,
  isAuthRejection,
} from "./errors/index.js";
import { config, getKomodoCredentials } from "./config/index.js";

const logger = baseLogger.child({ component: "KomodoClient" });

// ============================================================================
// Client Type
// ============================================================================

/** The raw komodo_client instance type */
type KomodoClientInstance = ReturnType<typeof createKomodoClient>;

// ============================================================================
// Komodo Client
// ============================================================================

export class KomodoClient {
  private readonly _client: KomodoClientInstance;
  private readonly _url: string;

  private constructor(url: string, client: KomodoClientInstance) {
    this._url = url;
    this._client = client;
  }

  /** The raw komodo_client SDK instance. */
  get client(): KomodoClientInstance {
    return this._client;
  }

  /** The base URL of the connected Komodo server. */
  get url(): string {
    return this._url;
  }

  /** Strip trailing slash from a URL. */
  private static normalizeUrl(url: string): string {
    return url.replace(/\/$/, "");
  }

  /**
   * Check if a Komodo server is reachable via GET /version.
   *
   * Any HTTP response (even 404) means the server is reachable.
   * Only network errors (ECONNREFUSED, ENOTFOUND, timeout) count as unreachable.
   */
  static async ping(url: string): Promise<{ reachable: true; version?: string } | { reachable: false; error: string }> {
    const normalized = KomodoClient.normalizeUrl(url);
    try {
      const response = await fetch(`${normalized}/version`, {
        signal: AbortSignal.timeout(config.API_TIMEOUT_MS),
      });
      if (response.ok) {
        const version = await response.text();
        return { reachable: true, version: version.trim() };
      }
      // Any HTTP response = server is reachable, even if endpoint is unknown
      return { reachable: true };
    } catch (error) {
      const message = error instanceof Error ? formatError(error) : String(error);
      return { reachable: false, error: message };
    }
  }

  /**
   * Login with username/password via komodo_client auth API.
   *
   * Creates an unauthenticated temporary client (empty JWT → no Authorization header),
   * calls LoginLocalUser, then constructs an authenticated client with the returned JWT.
   */
  static async login(baseUrl: string, username: string, password: string): Promise<KomodoClient> {
    const url = KomodoClient.normalizeUrl(baseUrl);
    const timeoutMs = config.API_TIMEOUT_MS;

    logger.trace('Authenticating as "%s" at %s', username, url);

    // Unauthenticated client: empty JWT means no Authorization header is sent,
    // which is required for the LoginLocalUser endpoint.
    const tempClient = createKomodoClient(url, { type: "jwt", params: { jwt: "" } });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(ConnectionError.timeout(url)), timeoutMs),
    );

    try {
      const result = await Promise.race([
        tempClient.auth.login("LoginLocalUser", { username, password }),
        timeoutPromise,
      ]);

      if (result.type !== "Jwt") {
        throw AuthenticationError.failed(
          `Two-factor authentication (${result.type}) is not supported by the MCP server`,
        );
      }

      if (!result.data.jwt) throw AuthenticationError.noToken();

      const client = createKomodoClient(url, { type: "jwt", params: { jwt: result.data.jwt } });
      logger.info("Successfully authenticated to %s", url);
      return new KomodoClient(url, client);
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof ConnectionError) throw error;
      // Detect auth failures from komodo_client plain object rejections
      if (isAuthRejection(error)) {
        throw AuthenticationError.invalidCredentials();
      }
      throw ConnectionError.failed(url, extractKomodoError(error));
    }
  }

  /**
   * Connect with API key/secret.
   * No network call needed — credentials are sent with every request.
   */
  static connectWithApiKey(baseUrl: string, key: string, secret: string): KomodoClient {
    const url = KomodoClient.normalizeUrl(baseUrl);
    logger.trace("Creating API-Key client for %s", url);
    const client = createKomodoClient(url, { type: "api-key", params: { key, secret } });
    return new KomodoClient(url, client);
  }

  /**
   * Connect with a pre-existing JWT token.
   *
   * Useful for tokens obtained via OIDC, GitHub, or Google OAuth in the browser.
   * No network call needed — the token is sent as Authorization header with every request.
   */
  static connectWithJwt(baseUrl: string, jwt: string): KomodoClient {
    const url = KomodoClient.normalizeUrl(baseUrl);
    logger.trace("Creating JWT client for %s", url);
    const client = createKomodoClient(url, { type: "jwt", params: { jwt } });
    return new KomodoClient(url, client);
  }

  /**
   * Query available login options from the Komodo server.
   * Useful for displaying which auth methods are enabled (local, GitHub, Google, OIDC).
   */
  static async getLoginOptions(
    baseUrl: string,
  ): Promise<{ local: boolean; github: boolean; google: boolean; oidc: boolean; registration_disabled: boolean }> {
    const url = KomodoClient.normalizeUrl(baseUrl);
    const tempClient = createKomodoClient(url, { type: "jwt", params: { jwt: "" } });
    return tempClient.auth.login("GetLoginOptions", {});
  }

  /**
   * Health check using core_version() — lightweight, validates connectivity and auth.
   *
   * Throws AuthenticationError on auth failures — these indicate wrong credentials
   * (API key/secret, expired JWT) and must not be swallowed as generic health failures.
   */
  async healthCheck(): Promise<{ healthy: boolean; version?: string; error?: string }> {
    try {
      const version = await this.client.core_version();
      return { healthy: true, version };
    } catch (error) {
      if (isAuthRejection(error)) {
        throw AuthenticationError.invalidCredentials();
      }
      return { healthy: false, error: extractKomodoError(error) };
    }
  }
}

// ============================================================================
// Auth Strategy Pattern
// ============================================================================

/** Authentication strategy for creating Komodo clients */
export interface KomodoAuth {
  readonly method: string;
  connect(url: string): Promise<KomodoClient>;
}

/** JWT-based auth via username/password login */
export class PasswordAuth implements KomodoAuth {
  readonly method = "password";
  constructor(
    private readonly username: string,
    private readonly password: string,
  ) {}
  connect(url: string): Promise<KomodoClient> {
    return KomodoClient.login(url, this.username, this.password);
  }
}

/** API key/secret auth — no network call needed for client creation */
export class ApiKeyAuth implements KomodoAuth {
  readonly method = "api-key";
  constructor(
    private readonly key: string,
    private readonly secret: string,
  ) {}
  async connect(url: string): Promise<KomodoClient> {
    return KomodoClient.connectWithApiKey(url, this.key, this.secret);
  }
}

/** Pre-existing JWT token auth — for tokens obtained via OIDC/OAuth browser flows */
export class JwtAuth implements KomodoAuth {
  readonly method = "jwt";
  constructor(private readonly jwt: string) {}
  async connect(url: string): Promise<KomodoClient> {
    return KomodoClient.connectWithJwt(url, this.jwt);
  }
}

/** Resolves credentials to an auth strategy, or null if insufficient */
export function resolveAuth(creds: {
  apiKey?: string | undefined;
  apiSecret?: string | undefined;
  username?: string | undefined;
  password?: string | undefined;
  jwtToken?: string | undefined;
}): KomodoAuth | null {
  if (creds.apiKey && creds.apiSecret) return new ApiKeyAuth(creds.apiKey, creds.apiSecret);
  if (creds.jwtToken) return new JwtAuth(creds.jwtToken);
  if (creds.username && creds.password) return new PasswordAuth(creds.username, creds.password);
  return null;
}

// ============================================================================
// Connection Manager
// ============================================================================

/**
 * Unified connection manager: state, client lifecycle, and auto-reconnect monitoring.
 *
 * Owns the KomodoClient reference, auth strategy, and periodic health checks.
 * Consumer-API: `connect()`, `getClient()`, `connected`, `stopMonitoring()`.
 */
class KomodoConnection {
  private client: KomodoClient | null = null;
  private auth: KomodoAuth | null = null;
  private url: string | null = null;
  private timer: NodeJS.Timeout | null = null;
  private retryDelay = 5_000;
  private readonly maxDelay = 60_000;
  private readonly checkIntervalMs: number;

  constructor(checkIntervalMs = 30_000) {
    this.checkIntervalMs = checkIntervalMs;
  }

  /** Returns the connected client, or null if not connected. */
  getClient(): KomodoClient | null {
    return this.client;
  }

  /** Whether a verified connection exists. */
  get connected(): boolean {
    return this.client !== null;
  }

  /**
   * Connect to Komodo: ping → authenticate → verify health → start monitoring.
   *
   * On success, replaces any previous connection and starts health monitoring.
   * On failure (health check), the previous connection remains active.
   * If auth.connect() throws, the previous connection is fully preserved.
   */
  async connect(auth: KomodoAuth, url: string): Promise<{ success: boolean; version?: string; error?: string }> {
    // Reachability check — fail fast before attempting auth
    const ping = await KomodoClient.ping(url);
    if (!ping.reachable) {
      throw ConnectionError.failed(url, ping.error);
    }

    const client = await auth.connect(url);
    const health = await client.healthCheck();

    if (!health.healthy) {
      return { success: false, ...(health.error !== undefined && { error: health.error }) };
    }

    this.stopMonitoring();
    this.client = client;
    this.auth = auth;
    this.url = url;
    this.retryDelay = 5_000;
    this.scheduleHealthCheck();
    logger.trace("Connection monitor started (interval: %dms)", this.checkIntervalMs);

    return health.version ? { success: true, version: health.version } : { success: true };
  }

  /**
   * Start the reconnect loop without an active connection.
   *
   * Used when the initial connection attempt fails — stores auth + url
   * so that `attemptReconnect()` can keep trying in the background.
   */
  startReconnecting(auth: KomodoAuth, url: string): void {
    this.stopMonitoring();
    this.auth = auth;
    this.url = url;
    this.retryDelay = 5_000;
    this.scheduleReconnect();
  }

  /** Stop health monitoring and reconnect attempts. */
  stopMonitoring(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
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
    if (!this.client) {
      this.scheduleHealthCheck();
      return;
    }

    try {
      const health = await this.client.healthCheck();
      if (health.healthy) {
        this.retryDelay = 5_000;
        this.scheduleHealthCheck();
      } else {
        logger.warn("Komodo health check failed: %s — initiating reconnect", health.error);
        this.client = null;
        this.scheduleReconnect();
      }
    } catch (error) {
      if (error instanceof AuthenticationError) {
        logger.warn("Authentication failed during health check — stopping monitor (credentials may be invalid)");
        this.client = null;
        return;
      }
      throw error;
    }
  }

  private async attemptReconnect(): Promise<void> {
    if (!this.auth || !this.url) {
      this.scheduleHealthCheck();
      return;
    }

    // Reachability check — skip full auth if server is down
    const ping = await KomodoClient.ping(this.url);
    if (!ping.reachable) {
      logger.trace("Server unreachable (%s) — skipping auth, retrying later", ping.error);
      this.scheduleReconnect();
      return;
    }

    logger.trace("Server reachable — attempting Komodo reconnection...");

    try {
      const client = await this.auth.connect(this.url);
      const health = await client.healthCheck();

      if (health.healthy) {
        this.client = client;
        logger.info("Komodo reconnection successful");
        this.retryDelay = 5_000;
        this.scheduleHealthCheck();
      } else {
        logger.debug("Reconnection failed: health check unsuccessful");
        this.scheduleReconnect();
      }
    } catch (error) {
      // Auth errors = bad credentials → stop retrying (would fail forever)
      if (isAuthRejection(error)) {
        logger.warn("Authentication failed during reconnect — stopping retry (credentials may be invalid)");
        return;
      }
      logger.trace("Reconnection attempt failed: %s", error instanceof Error ? error.message : String(error));
      this.scheduleReconnect();
    }
  }
}

export const komodoConnection = new KomodoConnection();

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

  const auth = resolveAuth(creds);
  if (!auth) {
    logger.info("No Komodo credentials configured - use komodo_configure tool to connect");
    return;
  }

  try {
    logger.debug("Connecting to Komodo at %s (%s)...", creds.url, auth.method);
    const { success } = await komodoConnection.connect(auth, creds.url);

    if (success) {
      logger.info("Komodo connection established");
    } else {
      logger.warn("Komodo health check failed — will keep retrying in the background");
      komodoConnection.startReconnecting(auth, creds.url);
    }
  } catch (error) {
    // Auth errors = bad credentials — don't retry, would fail forever
    if (isAuthRejection(error)) {
      logger.warn("Komodo authentication failed: %s", error instanceof Error ? error.message : String(error));
      return;
    }
    logger.warn(
      "Komodo connection failed: %s — will keep retrying in the background",
      error instanceof Error ? error.message : String(error),
    );
    komodoConnection.startReconnecting(auth, creds.url);
  }
}
