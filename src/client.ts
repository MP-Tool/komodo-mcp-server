/**
 * Komodo Client
 *
 * Thin wrapper around komodo_client with local connection tracking,
 * Auth Strategy Pattern, and automatic reconnection.
 *
 * @module client
 */

import { isIPv6 } from "node:net";
import { KomodoClient as createKomodoClient } from "komodo_client";
import type { Types } from "komodo_client";
import { logger as baseLogger, TooManyAttemptsError } from "mcp-server-framework";
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

/** Upper bound for the one-off probe of Komodo's login options at startup. */
const LOGIN_OPTIONS_TIMEOUT_MS = 5_000;

// ============================================================================
// Credentials
// ============================================================================

/**
 * What a signed-in session uses to talk to Komodo Core on its own behalf.
 *
 * - `jwt` — the Komodo JWT minted by a username/password login.
 * - `api-key` — a Komodo API key and secret the caller presented (Komodo's `X-API-KEY` /
 *   `X-API-SECRET`); the key belongs to a user or service user and carries their permissions.
 * - `service` — no credential of its own: the session belongs to a registered service
 *   client and acts through the server's `[komodo]` connection.
 */
export type KomodoCredential =
  | { readonly type: "jwt"; readonly jwt: string }
  | { readonly type: "api-key"; readonly key: string; readonly secret: string }
  | { readonly type: "service" };

/** A {@link KomodoCredential} that authenticates as the caller's own Komodo user. */
export type KomodoUserCredential = Exclude<KomodoCredential, { type: "service" }>;

/** The login methods Komodo Core has enabled (`GetLoginOptions`). */
export interface KomodoLoginOptions {
  /** Username/password login (`local_auth`). */
  readonly local: boolean;
  readonly oidc: boolean;
  readonly github: boolean;
  readonly google: boolean;
}

/**
 * Races `operation` against a timeout so an unresponsive Komodo cannot hold a login open.
 *
 * @throws {ConnectionError} when the timeout elapses first
 */
async function withTimeout<T>(url: string, timeoutMs: number, operation: Promise<T>): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(ConnectionError.timeout(url)), timeoutMs);
  });
  // Defensive: swallow a late rejection if the timer fires after the race already settled.
  void timeoutPromise.catch(() => {});
  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

// ============================================================================
// Checks in the Caller's Name
// ============================================================================

/**
 * Headers that name the caller of a credential check, as a proxy does: `Forwarded` (RFC 7239)
 * and the widespread `X-Forwarded-For`.
 *
 * Komodo slows down failed sign-ins per client address. This server checks credentials on its
 * callers' behalf; without these headers Komodo would count every caller's failures against
 * this server, and a few wrong guesses from anyone would lock out everyone. The address is the
 * one the framework determined — the connection's peer, or the client a trusted proxy names —
 * never a forwarding header a client set itself.
 *
 * @param callerAddress - The caller's address; nothing is forwarded without one
 */
export function forwardingHeaders(callerAddress: string | undefined): Record<string, string> {
  if (!callerAddress) return {};
  // RFC 7239 §6: an IPv6 address is bracketed, and quoted because it contains ":".
  const node = isIPv6(callerAddress) ? `"[${callerAddress}]"` : callerAddress;
  return { Forwarded: `for=${node}`, "X-Forwarded-For": callerAddress };
}

/** Komodo's "too many attempts", with the wait it names — `Retry-After`, or "Try again in 15s". */
export function tooManyAttempts(response: Response, body: unknown): TooManyAttemptsError {
  const header = Number(response.headers.get("retry-after"));
  const text = typeof body === "object" && body !== null ? (body as Record<string, unknown>)["error"] : undefined;
  const named = typeof text === "string" ? /try again in (\d+) ?s/i.exec(text)?.[1] : undefined;
  const wait = Number.isFinite(header) && header > 0 ? header : named !== undefined ? Number(named) : undefined;
  return new TooManyAttemptsError(wait, "Komodo refuses further sign-in attempts for now");
}

/** The headers that authenticate a request as the holder of `credential`, as komodo_client sends them. */
function credentialHeaders(credential: KomodoUserCredential): Record<string, string> {
  return credential.type === "jwt"
    ? { Authorization: credential.jwt }
    : { "X-Api-Key": credential.key, "X-Api-Secret": credential.secret };
}

/**
 * Sends a request that checks a credential — in the caller's name ({@link forwardingHeaders}),
 * which komodo_client has no way to add.
 *
 * @param body - JSON body of a POST; without one the request is a GET
 * @returns Komodo's answer
 * @throws {TooManyAttemptsError} when Komodo refuses further attempts for now
 * @throws {AuthenticationError} when Komodo rejects the credential
 * @throws {ConnectionError} when Komodo cannot be reached or answers otherwise
 */
async function credentialCheck(
  url: string,
  path: string,
  body: object | undefined,
  headers: Record<string, string>,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${url}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { ...(body !== undefined && { "Content-Type": "application/json" }), ...headers },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(config.KOMODO_API_TIMEOUT_MS),
      redirect: "error",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") throw ConnectionError.timeout(url);
    throw ConnectionError.failed(url, error instanceof Error ? error.message : String(error));
  }
  const result: unknown = await response.json().catch(() => undefined);
  if (response.status === 200) return result;
  if (response.status === 429) throw tooManyAttempts(response, result);
  const rejection = { status: response.status, result };
  if (isAuthRejection(rejection)) throw AuthenticationError.invalidCredentials();
  throw ConnectionError.failed(url, extractKomodoError(rejection));
}

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
  private readonly _credential: KomodoUserCredential;

  private constructor(url: string, client: KomodoClientInstance, credential: KomodoUserCredential) {
    this._url = url;
    this._client = client;
    this._credential = credential;
  }

  /** The raw komodo_client SDK instance. */
  get client(): KomodoClientInstance {
    return this._client;
  }

  /** The base URL of the connected Komodo server. */
  get url(): string {
    return this._url;
  }

  /**
   * Manage API keys for the connected Komodo user.
   *
   * komodo_client initializes MoghAuthClient with the JWT only, so its
   * auth.manage() calls are unauthenticated when the outer SDK client is
   * using an API key. Keep the existing SDK path for JWT connections and
   * use the same API-key headers as Komodo's /read and /write calls for
   * /auth/manage on service-account connections.
   */
  async createApiKey(name: string, expires: number): Promise<{ key: string; secret: string }> {
    if (this._credential.type !== "api-key") {
      return this._client.auth.manage("CreateApiKey", { name, expires });
    }
    return this.apiKeyAuthManage<{ key: string; secret: string }>("CreateApiKey", { name, expires });
  }

  async deleteApiKey(key: string): Promise<void> {
    if (this._credential.type !== "api-key") {
      await this._client.auth.manage("DeleteApiKey", { key });
      return;
    }
    await this.apiKeyAuthManage("DeleteApiKey", { key });
  }

  private async apiKeyAuthManage<T>(method: "CreateApiKey" | "DeleteApiKey", params: object): Promise<T> {
    const credentials = this._credential;
    if (credentials.type !== "api-key") throw new Error("API-key credentials are not configured");

    const response = await fetch(`${this._url}/auth/manage/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": credentials.key,
        "X-Api-Secret": credentials.secret,
      },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(config.KOMODO_API_TIMEOUT_MS),
      redirect: "error",
    });

    if (!response.ok) {
      // Do not include the response body: an upstream error might echo
      // credentials or the one-time secret into the MCP transcript.
      throw Object.assign(new Error(`Komodo auth/manage/${method} failed (HTTP ${response.status})`), {
        status: response.status,
      });
    }
    return (await response.json()) as T;
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
   * Login with username/password (Komodo's `LoginLocalUser`), returning the Komodo JWT.
   *
   * Used both for the global username/password connection and for the per-user local-login
   * flow (where the JWT is bound to the user's MCP session).
   *
   * @param callerAddress - Whose sign-in this is, when it is a caller's (see {@link forwardingHeaders})
   * @throws {AuthenticationError} on invalid credentials / unsupported 2FA
   * @throws {TooManyAttemptsError} when Komodo refuses further attempts for now
   * @throws {ConnectionError} on network failure / timeout
   */
  static async loginForJwt(
    baseUrl: string,
    username: string,
    password: string,
    callerAddress?: string,
  ): Promise<string> {
    const url = KomodoClient.normalizeUrl(baseUrl);
    logger.trace('Authenticating as "%s" at %s', username, url);

    const result = (await credentialCheck(
      url,
      "/auth/login/LoginLocalUser",
      { username, password },
      forwardingHeaders(callerAddress),
    )) as { type?: unknown; data?: { jwt?: unknown } } | undefined;

    if (result?.type !== "Jwt") {
      throw AuthenticationError.failed(
        `Two-factor authentication (${String(result?.type)}) is not supported by the MCP server`,
      );
    }
    if (typeof result.data?.jwt !== "string" || result.data.jwt === "") throw AuthenticationError.noToken();

    logger.info("Successfully authenticated to %s", url);
    return result.data.jwt;
  }

  /**
   * Which login methods Komodo Core itself offers (local, OIDC, GitHub, Google).
   *
   * Unauthenticated and cheap; used once at startup to decide whether to offer the
   * username/password form at all.
   *
   * @throws {ConnectionError} when Komodo cannot be reached in time
   */
  static async getLoginOptions(baseUrl: string): Promise<KomodoLoginOptions> {
    const url = KomodoClient.normalizeUrl(baseUrl);
    const tempClient = createKomodoClient(url, { type: "jwt", params: { jwt: "" } });
    try {
      return await withTimeout(
        url,
        Math.min(config.KOMODO_API_TIMEOUT_MS, LOGIN_OPTIONS_TIMEOUT_MS),
        tempClient.auth.login("GetLoginOptions", {}),
      );
    } catch (error) {
      if (error instanceof ConnectionError) throw error;
      throw ConnectionError.failed(url, extractKomodoError(error));
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
    return new KomodoClient(url, client, { type: "api-key", key, secret });
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
    return new KomodoClient(url, client, { type: "jwt", jwt });
  }

  /**
   * Connect with whatever credential a session holds for its own Komodo user.
   * No network call — see {@link connectWithJwt} / {@link connectWithApiKey}.
   */
  static connectWithCredential(baseUrl: string, credential: KomodoUserCredential): KomodoClient {
    return credential.type === "jwt"
      ? KomodoClient.connectWithJwt(baseUrl, credential.jwt)
      : KomodoClient.connectWithApiKey(baseUrl, credential.key, credential.secret);
  }

  /**
   * The Komodo user this client authenticates as — the round-trip that proves a credential.
   *
   * @param callerAddress - Whose credential this is, when it is a caller's (see {@link forwardingHeaders})
   * @throws {AuthenticationError} when Komodo rejects the credential (unknown or expired API
   *   key, wrong secret, expired JWT, disabled user)
   * @throws {TooManyAttemptsError} when Komodo refuses further attempts for now
   * @throws {ConnectionError} on network failure / timeout
   */
  async getUser(callerAddress?: string): Promise<Types.User> {
    const headers = { ...credentialHeaders(this._credential), ...forwardingHeaders(callerAddress) };
    // komodo_client's getUser(): GET /user.
    return (await credentialCheck(this._url, "/user", undefined, headers)) as Types.User;
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
 * The global service connection, built from the `[komodo]` credentials. It owns the
 * health-check + reconnect monitor. It serves anonymous requests (stdio, or HTTP with auth
 * disabled) and the sessions of registered service clients — never a signed-in user, who
 * always acts through their own credential.
 */
let globalConnection: KomodoConnection | null = null;

/**
 * Whether the server answers requests that carry no authentication at all: stdio, or HTTP
 * with auth disabled. Set by {@link configureKomodoConnections}.
 */
let anonymousMode = false;

/**
 * Configure the Komodo connection layer at startup, per operating mode.
 *
 * The global connection — built from the `[komodo]` credentials and kept healthy by its
 * monitor — is established only where something is entitled to use it:
 *
 * - **Anonymous mode** (stdio, or HTTP with auth disabled): it serves every request.
 * - **Authenticated mode with registered service clients**: it serves exactly the sessions
 *   of those clients (see `[auth.clients]`).
 * - **Authenticated mode otherwise**: it is not created at all — every request resolves a
 *   client from its own Komodo credential (see {@link connectUserClient}).
 *
 * @param opts.anonymousMode - true for stdio / auth-disabled HTTP
 * @param opts.serviceClients - true when registered service clients act as the `[komodo]` account
 */
export async function configureKomodoConnections(opts: {
  anonymousMode: boolean;
  serviceClients?: boolean;
}): Promise<void> {
  const creds = getKomodoCredentials();
  komodoBaseUrl = creds.url;
  anonymousMode = opts.anonymousMode;

  if (!opts.anonymousMode && !opts.serviceClients) {
    logger.info("Per-user authentication active — global Komodo credentials are not used");
    return;
  }
  const purpose = opts.anonymousMode ? "Anonymous mode" : "Service clients are registered";

  if (!creds.url) {
    logger.warn("%s but KOMODO_URL is not configured — Komodo tools will be unavailable", purpose);
    return;
  }

  const auth = resolveAuth(creds);
  if (!auth) {
    logger.warn("%s but no global Komodo credentials configured — Komodo tools will be unavailable", purpose);
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
 * Build the Komodo client for an authenticated user from the credential their session holds.
 *
 * The client is a thin, stateless wrapper over the credential (no socket/timer), built fresh
 * per call so it always carries the current request's credential — and so one user's call
 * can never resolve another user's connection.
 *
 * @param credential - The user's own Komodo credential (from `auth.extra`)
 * @throws {ClientNotConfiguredError} when no Komodo URL is configured
 */
export function connectUserClient(credential: KomodoUserCredential): KomodoClient {
  if (!komodoBaseUrl) throw ClientNotConfiguredError.notConfigured();
  return KomodoClient.connectWithCredential(komodoBaseUrl, credential);
}

/** The global service client (the `[komodo]` connection), or `null` when none is connected. */
export function getGlobalClient(): KomodoClient | null {
  return globalConnection?.getClient() ?? null;
}

/**
 * Whether a request without any authentication may be served (stdio, or HTTP with auth
 * disabled). With authentication on, the global connection can still exist — for registered
 * service clients — but it is not there for a caller nobody identified.
 */
export function servesAnonymousRequests(): boolean {
  return anonymousMode;
}

/** Stop the global connection monitor. Called on server shutdown. */
export function stopKomodoConnections(): void {
  globalConnection?.stopMonitoring();
  globalConnection = null;
  anonymousMode = false;
}
