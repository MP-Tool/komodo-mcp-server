/**
 * Komodo identity & permission binding.
 *
 * Bridges a Komodo user into the MCP session. However a caller authenticates — username and
 * password, an API key on the login page, an API key as OAuth client credentials or request
 * headers, or a registered service client — the result is the same thing: a Komodo user,
 * resolved via `GetUser` + `ListPermissions` by {@link buildKomodoContext}.
 *
 * - {@link komodoIdentity} — a typed `auth.extra` codec (built on the framework's
 *   {@link defineAuthExtra}) carrying the user's stable id, username, the credential the
 *   session uses against Komodo, admin flag, and a compact permission summary. Consumers
 *   read it via `getCurrentToolContext().auth` (the per-user Komodo client in
 *   `requireClient`, plus audit/logging).
 * - {@link deriveKomodoScopes} — maps a user's Komodo permissions onto the three MCP tool
 *   tiers (`komodo:read|operate|admin`) so tool calls are authorized **fail-early** at the
 *   MCP layer (Komodo remains the per-resource authority on every API call).
 *
 * @module auth/komodo-identity
 */

import { Types } from "komodo_client";
import { defineAuthExtra, logAuditEvent, type AuthInfo } from "mcp-server-framework";
import { ToolScopes, type ToolScope } from "../config/scopes.js";
import type { KomodoClient, KomodoCredential } from "../client.js";
import { AuthenticationError } from "../errors/index.js";

// ============================================================================
// Identity payload (auth.extra)
// ============================================================================

/**
 * How a session was authenticated:
 * - `password` — Komodo username and password on the login page
 * - `api-key` — a Komodo API key and secret (login page, OAuth client credentials, or headers)
 * - `service-client` — a client registered under `[auth.clients]`, acting as the server's
 *   `[komodo]` service account
 * - `sso` — a sign-in at an identity provider, which Komodo exchanged for a session of the
 *   Komodo user linked to it
 */
export type KomodoAuthMethod = "password" | "api-key" | "service-client" | "sso";

/**
 * Per-user Komodo identity carried in `auth.extra`.
 *
 * Only minted for users that exist in Komodo and are enabled — an absent identity
 * means no valid MCP session (enforced upstream in the auth hooks).
 */
export interface KomodoIdentity extends Record<string, unknown> {
  /** How this session was authenticated. */
  readonly method: KomodoAuthMethod;
  /** Stable Komodo user id (`_id.$oid`, falling back to username) — the session/connection key. */
  readonly komodoUserId: string;
  /** Globally-unique Komodo username. */
  readonly username: string;
  /**
   * What this session uses for its Komodo API calls. Never logged: the property name is on
   * the scrubber's sensitive-key list, so it is redacted wherever `auth.extra` surfaces.
   */
  readonly credential: KomodoCredential;
  /** For `service-client` sessions: the registered OAuth client that is acting. */
  readonly oauthClientId?: string | undefined;
  /** Whether the user holds global admin / super-admin in Komodo. */
  readonly isAdmin: boolean;
  /**
   * Komodo's `User.create_server_permissions` — may this non-admin create Servers?
   * One of the two flags Komodo Core actually consults in `user_can_create`, so it
   * is carried here to let create pre-checks fail early instead of round-tripping.
   */
  readonly canCreateServers: boolean;
  /** Komodo's `User.create_build_permissions` — may this non-admin create Builds? */
  readonly canCreateBuilds: boolean;
  /** User email / handle, when available. */
  readonly email?: string | undefined;
  /**
   * Compact snapshot of the user's global per-resource-type permission levels (`User.all`),
   * retained for audit/logging and future per-resource RBAC. Not used for tier gating.
   */
  readonly resourcePermissions?: Readonly<Record<string, string>> | undefined;
}

/** Runtime check for the credential carried in `auth.extra` (it crosses an untyped boundary). */
function isKomodoCredential(value: unknown): value is KomodoCredential {
  if (typeof value !== "object" || value === null) return false;
  const credential = value as Record<string, unknown>;
  switch (credential["type"]) {
    case "jwt":
      return typeof credential["jwt"] === "string" && credential["jwt"].length > 0;
    case "api-key":
      return typeof credential["key"] === "string" && typeof credential["secret"] === "string";
    case "service":
      return true;
    default:
      return false;
  }
}

/**
 * Typed read/write codec for {@link KomodoIdentity} on any auth carrier
 * (`AuthInfo`, `AuthContext` or `ToolContext.auth`), in both stateful and stateless transports.
 */
export const komodoIdentity = defineAuthExtra<KomodoIdentity>(
  (extra) => typeof extra["komodoUserId"] === "string" && isKomodoCredential(extra["credential"]),
);

// ============================================================================
// Permission → MCP scope derivation
// ============================================================================

/** Numeric rank for a Komodo permission level (higher = more capable). */
function levelRank(level: Types.PermissionLevel | string | undefined): number {
  switch (level) {
    case Types.PermissionLevel.Write:
      return 3;
    case Types.PermissionLevel.Execute:
      return 2;
    case Types.PermissionLevel.Read:
      return 1;
    default:
      return 0;
  }
}

const PERMISSION_LEVELS = new Set<string>(Object.values(Types.PermissionLevel));

/**
 * The level of a permission value as Komodo writes it.
 *
 * Komodo serialises a permission without resource-specific extras as the bare level
 * (`"Read"`) and one with extras as `{ level, specific }` — in `User.all` and in the
 * `GetPermission` response alike, whatever the generated client types say (#217).
 * A missing entry is no permission. Anything else is refused rather than read as some
 * level: an unknown permission must not be cached or treated as authorized.
 *
 * @throws Error when the value is no permission Komodo knows
 */
export function permissionLevelOf(permission: unknown): Types.PermissionLevel {
  if (permission === undefined) return Types.PermissionLevel.None;
  const level =
    typeof permission === "string"
      ? permission
      : permission !== null && typeof permission === "object" && "level" in permission
        ? permission.level
        : undefined;
  if (typeof level !== "string" || !PERMISSION_LEVELS.has(level)) {
    throw new Error("Unexpected Komodo permission value: invalid permission level");
  }
  return level as Types.PermissionLevel;
}

/**
 * Derive the MCP tool scopes a user is entitled to from their Komodo permissions.
 *
 * Tiers are inclusive (admin ⊃ operate ⊃ read):
 * - global `admin` / `super_admin` → all tiers
 * - highest permission level across `User.all` + `ListPermissions`:
 *   `Write` → admin, `Execute` → operate, `Read` → read
 * - `create_server_permissions` / `create_build_permissions` imply the admin tier
 *
 * A user with no Komodo permissions receives no scopes and is blocked fail-early from
 * every tool.
 *
 * @param user - The Komodo user (`getUser`)
 * @param permissions - The user's permission documents (`ListPermissions`)
 * @returns The granted MCP scopes
 */
export function deriveKomodoScopes(user: Types.User, permissions: readonly Types.Permission[]): ToolScope[] {
  if (user.admin || user.super_admin) {
    return [ToolScopes.READ, ToolScopes.OPERATE, ToolScopes.ADMIN];
  }

  let maxRank = 0;

  if (user.all) {
    for (const entry of Object.values(user.all)) {
      maxRank = Math.max(maxRank, levelRank(permissionLevelOf(entry)));
    }
  }
  for (const permission of permissions) {
    maxRank = Math.max(maxRank, levelRank(permission.level));
  }
  // The ability to create resources is an admin-tier capability even without
  // Write on any existing resource.
  if (user.create_server_permissions || user.create_build_permissions) {
    maxRank = 3;
  }

  const scopes: ToolScope[] = [];
  if (maxRank >= 1) scopes.push(ToolScopes.READ);
  if (maxRank >= 2) scopes.push(ToolScopes.OPERATE);
  if (maxRank >= 3) scopes.push(ToolScopes.ADMIN);
  return scopes;
}

/** Stable identity key for a Komodo user: the Mongo `_id`, falling back to username. */
export function komodoUserId(user: Types.User): string {
  return user._id?.$oid ?? user.username;
}

// ============================================================================
// Create-capability derivation (mirrors Komodo Core's `user_can_create`)
// ============================================================================

/** Komodo resource kinds a `*_apply` tool can create. */
export type CreatableResourceType = Exclude<Types.ResourceTarget["type"], "System">;

/**
 * Verdict of a create pre-check.
 *
 * `defer` exists because Komodo gates some kinds on the Core-side setting
 * `disable_non_admin_create`, which the MCP server cannot read. Deferring hands
 * the decision to Core rather than guessing — Core can only be stricter than we
 * are, never more permissive, so deferring never opens anything up.
 */
export type CreateVerdict = "allow" | "deny" | "defer";

/**
 * Resource kinds Komodo Core hard-gates to admins in `user_can_create`
 * (`bin/core/src/resource/{action,alerter,builder,sync}.rs`). Everything else is
 * either flag-gated (Server/Build) or `admin || !disable_non_admin_create`.
 */
const ADMIN_ONLY_CREATE: ReadonlySet<CreatableResourceType> = new Set<CreatableResourceType>([
  "Action",
  "Alerter",
  "Builder",
  "ResourceSync",
]);

/**
 * Can this identity create `resourceType`?
 *
 * Deliberately derived from the fields Komodo Core itself consults — `user.admin`
 * and the two `create_*_permissions` flags — NOT from `User.all`. Core does not
 * look at `User.all` when creating, so gating on it would reject users Komodo
 * would happily let through (e.g. creating a Stack without Write on Stacks).
 *
 * @param identity - The per-user Komodo identity, or `undefined` in anonymous/global mode
 * @returns `allow` / `deny`, or `defer` when only Komodo Core can decide
 */
export function canCreateResource(
  identity: KomodoIdentity | undefined,
  resourceType: CreatableResourceType,
): CreateVerdict {
  if (!identity) return "defer"; // anonymous / global mode — the service account governs
  if (identity.isAdmin) return "allow";
  if (ADMIN_ONLY_CREATE.has(resourceType)) return "deny";
  if (resourceType === "Server") return identity.canCreateServers ? "defer" : "deny";
  if (resourceType === "Build") return identity.canCreateBuilds ? "defer" : "deny";
  // Stack / Deployment / Repo / Procedure / Swarm — `admin || !disable_non_admin_create`.
  return "defer";
}

/** Whether a held permission level satisfies a required level (Write ⊃ Execute ⊃ Read ⊃ None). */
export function meetsPermissionLevel(have: Types.PermissionLevel, required: Types.PermissionLevel): boolean {
  return levelRank(have) >= levelRank(required);
}

/** Compact `{ resourceType → level }` summary of a user's global permissions, for audit. */
export function summarizeResourcePermissions(user: Types.User): Record<string, string> | undefined {
  if (!user.all) return undefined;
  const summary: Record<string, string> = {};
  for (const [resourceType, entry] of Object.entries(user.all)) {
    const level = permissionLevelOf(entry);
    if (level !== Types.PermissionLevel.None) {
      summary[resourceType] = level;
    }
  }
  return Object.keys(summary).length > 0 ? summary : undefined;
}

// ============================================================================
// Session context (shared by every way of authenticating)
// ============================================================================

/** Resolved Komodo session: the user's bound identity + derived MCP scopes. */
export interface KomodoSessionContext {
  readonly scopes: readonly ToolScope[];
  readonly identity: KomodoIdentity;
}

/**
 * Resolve the Komodo session a credential stands for.
 *
 * Asks Komodo who the credential belongs to, verifies that user is enabled, pulls their
 * permissions and derives the MCP scopes. This is the single place a credential becomes an
 * identity — every authentication path ends here, so they cannot drift apart.
 *
 * Deliberately silent on success: callers decide whether what happened was a login worth an
 * audit entry (see {@link auditLogin}) or a routine re-validation.
 *
 * @param client - A Komodo client that authenticates with `credential`
 * @param credential - What the resulting session will use for its Komodo API calls
 * @param method - How the caller authenticated
 * @param options.oauthClientId - For `service-client` sessions: the registered client that is acting
 * @param options.callerAddress - Whose credential is checked, when it is a caller's: Komodo
 *   counts a failed check against that address, not against this server
 * @throws {AuthenticationError} when Komodo rejects the credential or the user is disabled
 * @throws {TooManyAttemptsError} when Komodo refuses further attempts for now
 * @throws {ConnectionError} when Komodo cannot be reached
 */
export async function buildKomodoContext(
  client: KomodoClient,
  credential: KomodoCredential,
  method: KomodoAuthMethod,
  options: { readonly oauthClientId?: string; readonly callerAddress?: string | undefined } = {},
): Promise<KomodoSessionContext> {
  const { oauthClientId } = options;
  const user = await client.getUser(options.callerAddress);

  if (user.enabled === false) {
    logAuditEvent({
      category: "auth",
      action: "login",
      outcome: "denied",
      actor: { userId: komodoUserId(user), username: user.username },
      detail: { method, reason: "user_disabled" },
    });
    throw AuthenticationError.failed(`Komodo user "${user.username}" is disabled — access denied`);
  }

  const permissions = await client.client.read("ListPermissions", {});
  const scopes = deriveKomodoScopes(user, permissions);
  const resourcePermissions = summarizeResourcePermissions(user);

  const identity: KomodoIdentity = {
    method,
    komodoUserId: komodoUserId(user),
    username: user.username,
    credential,
    ...(oauthClientId !== undefined && { oauthClientId }),
    isAdmin: Boolean(user.admin || user.super_admin),
    canCreateServers: Boolean(user.create_server_permissions),
    canCreateBuilds: Boolean(user.create_build_permissions),
    ...(resourcePermissions && { resourcePermissions }),
  };

  return { scopes, identity };
}

/**
 * Record a successful login in the audit trail.
 *
 * @param ctx - The session that was just established
 * @param via - Which door the caller came through (login page, token endpoint, …)
 */
export function auditLogin(ctx: KomodoSessionContext, via: string): void {
  const { identity } = ctx;
  logAuditEvent({
    category: "auth",
    action: "login",
    outcome: "success",
    actor: { userId: identity.komodoUserId, username: identity.username },
    detail: {
      method: identity.method,
      via,
      isAdmin: identity.isAdmin,
      scopes: ctx.scopes,
      ...(identity.oauthClientId !== undefined && { client: identity.oauthClientId }),
    },
  });
}

/**
 * When a Komodo JWT stops being accepted, in epoch seconds — or `undefined` if it cannot be
 * read from the token.
 *
 * The token is only decoded, not verified: Komodo verifies it on every call, and this value
 * merely tells the MCP session when re-authentication will become necessary. Komodo writes
 * `exp` in milliseconds; a value small enough to be seconds is taken as seconds, so a
 * standards-conformant token is read correctly too.
 */
export function komodoJwtExpiry(jwt: string): number | undefined {
  const payload = jwt.split(".")[1];
  if (!payload) return undefined;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as { exp?: unknown };
    if (typeof claims.exp !== "number" || !Number.isFinite(claims.exp) || claims.exp <= 0) return undefined;
    return Math.floor(claims.exp >= 1e11 ? claims.exp / 1000 : claims.exp);
  } catch {
    return undefined;
  }
}

/**
 * The principal an MCP session belongs to — what the framework ties sessions and audit
 * entries to.
 *
 * Normally that is the Komodo user. Registered service clients all act as the same Komodo
 * service account, so each one is its own principal: one client cannot attach to another
 * client's session, and the audit trail shows which client made a call.
 */
export function principalId(identity: KomodoIdentity): string {
  return identity.oauthClientId !== undefined ? `service-client:${identity.oauthClientId}` : identity.komodoUserId;
}

/** Fallback session length when a JWT's own expiry cannot be read. */
const UNKNOWN_JWT_SESSION_SECONDS = 3600;

/**
 * Assemble the framework {@link AuthInfo} describing a session's principal.
 *
 * `scopes` are what the user is entitled to. `expiresAt` caps the MCP session at the
 * lifetime of the Komodo credential behind it: a JWT expires on Komodo's schedule and
 * cannot be renewed without the password, so the session must end with it. API keys and
 * the service account have no such deadline — those sessions are re-validated against
 * Komodo instead whenever their refresh token is used.
 *
 * @param ctx - The resolved session context
 * @param email - Optional email to attach to the bound identity
 */
export function komodoAuthInfo(ctx: KomodoSessionContext, email?: string): AuthInfo {
  const { credential } = ctx.identity;
  const expiresAt =
    credential.type === "jwt"
      ? (komodoJwtExpiry(credential.jwt) ?? Math.floor(Date.now() / 1000) + UNKNOWN_JWT_SESSION_SECONDS)
      : undefined;

  return {
    // The bearer token of a request is the one the MCP server issued; the Komodo credential
    // lives in `extra` only.
    token: "",
    clientId: principalId(ctx.identity),
    scopes: [...ctx.scopes],
    ...(expiresAt !== undefined && { expiresAt }),
    extra: komodoIdentity.write({ ...ctx.identity, ...(email && { email }) }),
  };
}
