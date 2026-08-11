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
  ClientNotConfiguredError,
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
        signal: AbortSignal.timeout(config.KOMODO_API_TIMEOUT_MS),
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
   * Login with username/password via komodo_client auth API, returning the Komodo JWT.
   *
   * Creates an unauthenticated temporary client (empty JWT → no Authorization header) and
   * calls LoginLocalUser. Used both for the global username/password connection and for the
   * per-user local-login flow (where the JWT is bound to the user's MCP session).
   *
   * @throws {AuthenticationError} on invalid credentials / unsupported 2FA
   * @throws {ConnectionError} on network failure / timeout
   */
  static async loginForJwt(baseUrl: string, username: string, password: string): Promise<string> {
    const url = KomodoClient.normalizeUrl(baseUrl);
    const timeoutMs = config.KOMODO_API_TIMEOUT_MS;

    logger.trace('Authenticating as "%s" at %s', username, url);

    // Unauthenticated client: empty JWT means no Authorization header is sent,
    // which is required for the LoginLocalUser endpoint.
    const tempClient = createKomodoClient(url, { type: "jwt", params: { jwt: "" } });

    let timeoutHandle: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(ConnectionError.timeout(url)), timeoutMs);
    });
    // Defensive: swallow a late rejection if the timer fires after the race already settled.
    void timeoutPromise.catch(() => {});

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

      logger.info("Successfully authenticated to %s", url);
      return result.data.jwt;
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof ConnectionError) throw error;
      // Detect auth failures from komodo_client plain object rejections
      if (isAuthRejection(error)) {
        throw AuthenticationError.invalidCredentials();
      }
      throw ConnectionError.failed(url, extractKomodoError(error));
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    }
  }

  /**
   * Login with username/password, returning a ready-to-use authenticated client.
   * Thin wrapper over {@link loginForJwt} + {@link connectWithJwt}.
   */
  static async login(baseUrl: string, username: string, password: string): Promise<KomodoClient> {
    const jwt = await KomodoClient.loginForJwt(baseUrl, username, password);
    return KomodoClient.connectWithJwt(baseUrl, jwt);
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

/**
 * Resolve global connection credentials to an auth strategy, or `null` if insufficient.
 *
 * Used only for the **global** Komodo connection — the service-account fallback active
 * in stdio mode and in HTTP mode with auth disabled. Per-user (OAuth) sessions never go
 * through here; they connect with the user's own minted JWT. Precedence:
 * API key/secret → JWT → username/password.
 */
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
      // healthCheck() reports every other failure as `{ healthy: false }`; an
      // AuthenticationError is the only thing it throws. Re-throwing anything else
      // would escape through the `void` in scheduleHealthCheck() as an unhandled
      // rejection AND leave the monitor dead, so treat it like any other outage.
      if (error instanceof AuthenticationError) {
        logger.warn("Authentication failed during health check — stopping monitor (credentials may be invalid)");
        this.client = null;
        return;
      }
      logger.warn(
        "Unexpected error during Komodo health check: %s — initiating reconnect",
        error instanceof Error ? error.message : String(error),
      );
      this.client = null;
      this.scheduleReconnect();
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

// ============================================================================
// Connection Resolution (mode-aware)
// ============================================================================

/**
 * The server's downstream Komodo base URL, captured at startup.
 * Set by {@link configureKomodoConnections}; read when building per-user clients.
 */
let komodoBaseUrl: string | undefined;

/**
 * The global service connection — the credential fallback used ONLY when no per-user
 * identity is present (stdio, or HTTP with auth disabled). It owns the health-check +
 * reconnect monitor. Authenticated per-user sessions never touch it.
 */
let globalConnection: KomodoConnection | null = null;

/**
 * Configure the Komodo connection layer at startup, per operating mode.
 *
 * - **Anonymous mode** (stdio, or HTTP with auth disabled): establish a single global
 *   connection from the `[komodo]` credentials and keep it healthy via its monitor.
 * - **Authenticated mode** (HTTP + auth): create nothing here — every request resolves a
 *   per-user client from its own minted Komodo JWT (see {@link connectUserClient}).
 *
 * @param opts.anonymousMode - true for stdio / auth-disabled HTTP
 */
export async function configureKomodoConnections(opts: { anonymousMode: boolean }): Promise<void> {
  const creds = getKomodoCredentials();
  komodoBaseUrl = creds.url;

  if (!opts.anonymousMode) {
    logger.info("Per-user authentication active — global Komodo credentials are not used");
    return;
  }

  if (!creds.url) {
    logger.warn("Anonymous mode but KOMODO_URL is not configured — Komodo tools will be unavailable");
    return;
  }

  const auth = resolveAuth(creds);
  if (!auth) {
    logger.warn("Anonymous mode but no global Komodo credentials configured — Komodo tools will be unavailable");
    return;
  }

  const connection = new KomodoConnection();
  globalConnection = connection;
  try {
    const { success, error } = await connection.connect(auth, creds.url);
    if (success) {
      logger.info("Global Komodo connection established (%s)", auth.method);
    } else {
      logger.warn("Global Komodo health check failed (%s) — reconnect will continue in background", error);
      connection.startReconnecting(auth, creds.url);
    }
  } catch (error) {
    if (isAuthRejection(error)) {
      logger.error(
        "Global Komodo authentication failed — check credentials: %s",
        error instanceof Error ? error.message : String(error),
      );
      globalConnection = null;
      return;
    }
    logger.warn(
      "Global Komodo connection failed: %s — reconnect will continue in background",
      error instanceof Error ? error.message : String(error),
    );
    connection.startReconnecting(auth, creds.url);
  }
}

/**
 * Build the Komodo client for an authenticated user from their minted JWT.
 *
 * The client is a thin, stateless wrapper over the JWT (no socket/timer), built fresh per
 * call so it always carries the current request's token — and so one user's call can never
 * resolve another user's connection.
 *
 * @param jwt - The user's Komodo JWT (from `auth.extra`)
 * @throws {ClientNotConfiguredError} when no Komodo URL is configured
 */
export function connectUserClient(jwt: string): KomodoClient {
  if (!komodoBaseUrl) throw ClientNotConfiguredError.notConfigured();
  return KomodoClient.connectWithJwt(komodoBaseUrl, jwt);
}

/** The global service client (anonymous mode), or `null` when none is connected. */
export function getGlobalClient(): KomodoClient | null {
  return globalConnection?.getClient() ?? null;
}

/** Stop the global connection monitor. Called on server shutdown. */
export function stopKomodoConnections(): void {
  globalConnection?.stopMonitoring();
  globalConnection = null;
}
