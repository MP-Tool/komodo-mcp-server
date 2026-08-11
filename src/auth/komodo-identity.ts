/**
 * Komodo identity & permission binding.
 *
 * Bridges a Komodo user (resolved once at OAuth time via `getUser` + `ListPermissions`)
 * into the MCP session:
 *
 * - {@link komodoIdentity} — a typed `auth.extra` codec (built on the framework's
 *   {@link defineAuthExtra}) carrying the user's stable id, username, minted Komodo JWT,
 *   admin flag, and a compact permission summary. The producer is `mapUserInfo`
 *   (`src/index.ts`); consumers read it via `getCurrentToolContext().auth` (the per-user
 *   Komodo client in `requireClient`, plus audit/logging).
 * - {@link deriveKomodoScopes} — maps a user's Komodo permissions onto the three MCP tool
 *   tiers (`komodo:read|operate|admin`) so tool calls are authorized **fail-early** at the
 *   MCP layer (Komodo remains the per-resource authority on every API call).
 *
 * @module auth/komodo-identity
 */

import { Types } from "komodo_client";
import { defineAuthExtra, logAuditEvent, type AuthInfo } from "mcp-server-framework";
import { ToolScopes, type ToolScope } from "../config/scopes.js";
import { KomodoClient } from "../client.js";
import { AuthenticationError } from "../errors/index.js";

// ============================================================================
// Identity payload (auth.extra)
// ============================================================================

/**
 * Per-user Komodo identity embedded in `auth.extra` by the OAuth `mapUserInfo` hook.
 *
 * Only minted for users that exist in Komodo and are enabled — an absent identity
 * means no valid MCP session (enforced upstream in the auth hooks).
 */
export interface KomodoIdentity extends Record<string, unknown> {
  /** Authentication method: an upstream OAuth provider, or local username/password. */
  readonly provider: "google" | "github" | "oidc" | "local";
  /** Stable Komodo user id (`_id.$oid`, falling back to username) — the session/connection key. */
  readonly komodoUserId: string;
  /** Globally-unique Komodo username. */
  readonly username: string;
  /** Komodo JWT minted by `ExchangeProviderTokenForJwt`, used for this user's API calls. */
  readonly komodoJwt: string;
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

/**
 * Typed read/write codec for {@link KomodoIdentity} on any auth carrier
 * (`AuthContext` or `ToolContext.auth`), in both stateful and stateless transports.
 */
export const komodoIdentity = defineAuthExtra<KomodoIdentity>(
  (extra) => typeof extra["komodoUserId"] === "string" && typeof extra["komodoJwt"] === "string",
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

/** Extract the level from a `User.all` entry (which is a level string or `{ level, specific }`). */
function entryLevel(entry: Types.PermissionLevelAndSpecifics | Types.PermissionLevel | undefined): number {
  if (entry === undefined) return 0;
  if (typeof entry === "string") return levelRank(entry);
  return levelRank(entry.level);
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
      maxRank = Math.max(maxRank, entryLevel(entry));
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
    const level = typeof entry === "string" ? entry : entry.level;
    if (level !== Types.PermissionLevel.None) {
      summary[resourceType] = level;
    }
  }
  return Object.keys(summary).length > 0 ? summary : undefined;
}

// ============================================================================
// Session context (shared by OAuth + local login)
// ============================================================================

/** Resolved Komodo session: the user's bound identity + derived MCP scopes. */
export interface KomodoSessionContext {
  readonly scopes: readonly ToolScope[];
  readonly identity: KomodoIdentity;
}

/**
 * Resolve a Komodo session from a freshly-minted Komodo JWT.
 *
 * Verifies the user exists and is enabled (else throws {@link AuthenticationError}), pulls
 * their permissions, derives MCP scopes, and records a login audit event. Shared by the
 * OAuth flow (after `exchangeProviderToken`) and the local username/password login.
 *
 * @throws {AuthenticationError} when the user is disabled — callers map this to a denial.
 */
export async function buildKomodoContext(
  komodoUrl: string,
  jwt: string,
  provider: KomodoIdentity["provider"],
): Promise<KomodoSessionContext> {
  const client = KomodoClient.connectWithJwt(komodoUrl, jwt).client;
  const user = await client.getUser();

  if (user.enabled === false) {
    logAuditEvent({
      category: "auth",
      action: "login",
      outcome: "denied",
      actor: { userId: komodoUserId(user), username: user.username },
      detail: { provider, reason: "user_disabled" },
    });
    throw AuthenticationError.failed(`Komodo user "${user.username}" is disabled — access denied`);
  }

  const permissions = await client.read("ListPermissions", {});
  const scopes = deriveKomodoScopes(user, permissions);
  const resourcePermissions = summarizeResourcePermissions(user);

  const identity: KomodoIdentity = {
    provider,
    komodoUserId: komodoUserId(user),
    username: user.username,
    komodoJwt: jwt,
    isAdmin: Boolean(user.admin || user.super_admin),
    canCreateServers: Boolean(user.create_server_permissions),
    canCreateBuilds: Boolean(user.create_build_permissions),
    ...(resourcePermissions && { resourcePermissions }),
  };

  logAuditEvent({
    category: "auth",
    action: "login",
    outcome: "success",
    actor: { userId: identity.komodoUserId, username: identity.username },
    detail: { provider, isAdmin: identity.isAdmin, scopes },
  });

  return { scopes, identity };
}

/**
 * Assemble framework {@link AuthInfo} from a {@link KomodoSessionContext}.
 *
 * @param ctx - The resolved session context
 * @param token - Token string recorded on AuthInfo (upstream access token, or the Komodo JWT)
 * @param email - Optional email to attach to the bound identity (from OAuth userinfo)
 */
export function komodoAuthInfo(ctx: KomodoSessionContext, token: string, email?: string): AuthInfo {
  return {
    token,
    clientId: ctx.identity.komodoUserId,
    scopes: [...ctx.scopes],
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    extra: komodoIdentity.write({ ...ctx.identity, ...(email && { email }) }),
  };
}
