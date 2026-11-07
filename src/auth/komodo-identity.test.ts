// Must precede any komodo_client import — mogh_auth_client touches localStorage at
// module load, same reason src/server.ts imports this first.
import "../utils/polyfills.js";

import { test } from "node:test";
import assert from "node:assert/strict";
import { Types } from "komodo_client";
import {
  buildKomodoContext,
  canCreateResource,
  komodoAuthInfo,
  komodoIdentity,
  komodoJwtExpiry,
  permissionLevelOf,
  principalId,
} from "./komodo-identity.js";
import type { KomodoIdentity, CreatableResourceType, KomodoSessionContext } from "./komodo-identity.js";
import type { KomodoClient, KomodoCredential } from "../client.js";
import { AuthenticationError } from "../errors/index.js";
import { ToolScopes } from "../config/scopes.js";

// ============================================================================
// Create-capability derivation.
//
// Pins the mapping against Komodo Core's own `user_can_create`
// (`bin/core/src/resource/*.rs`). The rule that matters: this must never deny
// what Core would allow. Core gates Stack/Deployment/Repo/Procedure/Swarm on
// `disable_non_admin_create`, a Core-side setting the MCP server cannot read —
// those defer. Deferring is always safe: Core still decides, and Core can only
// be stricter.
// ============================================================================

function identity(overrides: Partial<KomodoIdentity> = {}): KomodoIdentity {
  return {
    method: "password",
    komodoUserId: "u1",
    username: "alice",
    credential: { type: "jwt", jwt: "jwt" },
    isAdmin: false,
    canCreateServers: false,
    canCreateBuilds: false,
    ...overrides,
  };
}

const ADMIN_ONLY: CreatableResourceType[] = ["Action", "Alerter", "Builder", "ResourceSync"];
const CORE_DECIDES: CreatableResourceType[] = ["Stack", "Deployment", "Repo", "Procedure", "Swarm"];

test("admins may create every resource kind", () => {
  const admin = identity({ isAdmin: true });
  for (const type of [...ADMIN_ONLY, ...CORE_DECIDES, "Server", "Build"] as CreatableResourceType[]) {
    assert.equal(canCreateResource(admin, type), "allow", `admin should create ${type}`);
  }
});

test("non-admins are denied the kinds Komodo Core hard-gates to admins", () => {
  const user = identity();
  for (const type of ADMIN_ONLY) {
    assert.equal(canCreateResource(user, type), "deny", `${type} is admin-only in Core`);
  }
});

test("non-admins defer on the kinds gated by Core's disable_non_admin_create", () => {
  const user = identity();
  for (const type of CORE_DECIDES) {
    assert.equal(canCreateResource(user, type), "defer", `${type} depends on Core config`);
  }
});

test("Server creation follows create_server_permissions", () => {
  assert.equal(canCreateResource(identity({ canCreateServers: true }), "Server"), "defer");
  assert.equal(canCreateResource(identity({ canCreateServers: false }), "Server"), "deny");
});

test("Build creation follows create_build_permissions", () => {
  assert.equal(canCreateResource(identity({ canCreateBuilds: true }), "Build"), "defer");
  assert.equal(canCreateResource(identity({ canCreateBuilds: false }), "Build"), "deny");
});

test("the two create flags are independent of one another", () => {
  const serversOnly = identity({ canCreateServers: true });
  assert.equal(canCreateResource(serversOnly, "Server"), "defer");
  assert.equal(canCreateResource(serversOnly, "Build"), "deny");
});

test("anonymous/global mode defers everything to the service account", () => {
  // stdio and auth-disabled HTTP carry no per-user identity; the global Komodo
  // connection's own rights govern, exactly as in requireKomodoPermission.
  for (const type of [...ADMIN_ONLY, ...CORE_DECIDES, "Server", "Build"] as CreatableResourceType[]) {
    assert.equal(canCreateResource(undefined, type), "defer", `anonymous should defer ${type}`);
  }
});

test("a Write permission on some resource does not by itself grant creation", () => {
  // deriveKomodoScopes() hands out komodo:admin to anyone holding Write on a
  // single resource. That scope opens the *_apply tools, so the create branch
  // must not treat it as a create right — this is the gap the pre-check closes.
  const writer = identity({ resourcePermissions: { Stack: "Write" } });
  assert.equal(canCreateResource(writer, "Alerter"), "deny");
  assert.equal(canCreateResource(writer, "Server"), "deny");
});

// ============================================================================
// Identity codec — what counts as a Komodo identity in `auth.extra`.
//
// `requireClient` trusts this guard to decide whether a request has a Komodo
// identity at all. An `extra` bag that merely looks similar must not pass.
// ============================================================================

test("the codec round-trips an identity for every credential type", () => {
  const credentials: KomodoCredential[] = [
    { type: "jwt", jwt: "header.payload.signature" },
    { type: "api-key", key: "K_abc_K", secret: "S_abc_S" },
    { type: "service" },
  ];
  for (const credential of credentials) {
    const extra = komodoIdentity.write(identity({ credential }));
    assert.deepEqual(komodoIdentity.read({ extra })?.credential, credential);
  }
});

test("the codec rejects an extra bag without a usable credential", () => {
  const base = { komodoUserId: "u1", username: "alice" };
  const invalid: Record<string, unknown>[] = [
    base, // no credential at all
    { ...base, credential: "jwt" },
    { ...base, credential: { type: "jwt" } }, // jwt missing
    { ...base, credential: { type: "jwt", jwt: "" } },
    { ...base, credential: { type: "api-key", key: "K_abc_K" } }, // secret missing
    { ...base, credential: { type: "something-else" } },
    { credential: { type: "service" } }, // no user id
    { ...base, komodoJwt: "legacy-shape" }, // the pre-1.5.1 payload is not an identity any more
  ];
  for (const extra of invalid) {
    assert.equal(komodoIdentity.read({ extra }), undefined, JSON.stringify(extra));
  }
  assert.equal(komodoIdentity.read(undefined), undefined);
});

// ============================================================================
// Session lifetime — an MCP session must not outlive the Komodo credential behind it.
// ============================================================================

/** A JWT-shaped string with the given claims (signature irrelevant — it is only decoded). */
function jwtWith(claims: Record<string, unknown>): string {
  const encode = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256" })}.${encode(claims)}.signature`;
}

test("komodoJwtExpiry reads Komodo's millisecond exp claim as epoch seconds", () => {
  assert.equal(komodoJwtExpiry(jwtWith({ sub: "u1", exp: 1_800_000_000_000 })), 1_800_000_000);
});

test("komodoJwtExpiry also reads a standard exp claim in seconds", () => {
  assert.equal(komodoJwtExpiry(jwtWith({ sub: "u1", exp: 1_800_000_000 })), 1_800_000_000);
});

test("komodoJwtExpiry gives up on tokens it cannot read", () => {
  for (const token of [
    "",
    "not-a-jwt",
    "a.b.c",
    jwtWith({ sub: "u1" }),
    jwtWith({ exp: "soon" }),
    jwtWith({ exp: -1 }),
  ]) {
    assert.equal(komodoJwtExpiry(token), undefined, token);
  }
});

function context(overrides: Partial<KomodoIdentity> = {}): KomodoSessionContext {
  return { scopes: [ToolScopes.READ, ToolScopes.OPERATE], identity: identity(overrides) };
}

test("a password session ends when its Komodo JWT does", () => {
  const jwt = jwtWith({ sub: "u1", exp: 1_800_000_000_000 });
  const authInfo = komodoAuthInfo(context({ credential: { type: "jwt", jwt } }));
  assert.equal(authInfo.expiresAt, 1_800_000_000);
});

test("a password session with an unreadable JWT falls back to one hour", () => {
  const before = Math.floor(Date.now() / 1000);
  const authInfo = komodoAuthInfo(context({ credential: { type: "jwt", jwt: "opaque" } }));
  assert.ok(authInfo.expiresAt !== undefined && authInfo.expiresAt >= before + 3600 - 1);
  assert.ok(authInfo.expiresAt <= before + 3600 + 5);
});

test("API-key and service sessions carry no deadline of their own", () => {
  const apiKey = komodoAuthInfo(context({ method: "api-key", credential: { type: "api-key", key: "K", secret: "S" } }));
  const service = komodoAuthInfo(
    context({ method: "service-client", credential: { type: "service" }, oauthClientId: "gateway" }),
  );
  assert.equal(apiKey.expiresAt, undefined);
  assert.equal(service.expiresAt, undefined);
});

test("komodoAuthInfo never puts the Komodo credential where a bearer token goes", () => {
  const secret = "S_supersecretsupersecret_S";
  const authInfo = komodoAuthInfo(context({ credential: { type: "api-key", key: "K_key_K", secret } }));
  assert.equal(authInfo.token, "");
  assert.deepEqual(authInfo.scopes, [ToolScopes.READ, ToolScopes.OPERATE]);
  // It is carried in `extra.credential` only — a property name the scrubber redacts.
  assert.deepEqual(komodoIdentity.read(authInfo)?.credential, { type: "api-key", key: "K_key_K", secret });
});

// ============================================================================
// Principal — what a session is tied to.
// ============================================================================

test("a user session's principal is the Komodo user", () => {
  assert.equal(principalId(identity()), "u1");
  assert.equal(komodoAuthInfo(context()).clientId, "u1");
});

test("each registered service client is its own principal, even on the same service account", () => {
  const a = identity({ method: "service-client", credential: { type: "service" }, oauthClientId: "gateway-a" });
  const b = identity({ method: "service-client", credential: { type: "service" }, oauthClientId: "gateway-b" });
  assert.equal(a.komodoUserId, b.komodoUserId);
  assert.notEqual(principalId(a), principalId(b));
  // ...and cannot collide with a Komodo user id.
  assert.equal(principalId(a), "service-client:gateway-a");
});

// ============================================================================
// buildKomodoContext — the one place a credential becomes an identity.
// ============================================================================

interface FakeUser extends Partial<Types.User> {
  username: string;
}

/** A Komodo client double that answers `GetUser` / `ListPermissions` from memory. */
function fakeClient(user: FakeUser | Error, permissions: Partial<Types.Permission>[] = []): KomodoClient {
  return {
    getUser: async () => {
      if (user instanceof Error) throw user;
      return user as Types.User;
    },
    client: { read: async () => permissions },
  } as unknown as KomodoClient;
}

test("buildKomodoContext binds the user, the credential and scopes from real permissions", async () => {
  const credential: KomodoCredential = { type: "api-key", key: "K_key_K", secret: "S_secret_S" };
  const user: FakeUser = { _id: { $oid: "abc123" }, username: "deploy-bot", enabled: true };
  const ctx = await buildKomodoContext(
    fakeClient(user, [{ level: Types.PermissionLevel.Execute }]),
    credential,
    "api-key",
  );

  assert.equal(ctx.identity.komodoUserId, "abc123");
  assert.equal(ctx.identity.username, "deploy-bot");
  assert.equal(ctx.identity.method, "api-key");
  assert.deepEqual(ctx.identity.credential, credential);
  assert.equal(ctx.identity.isAdmin, false);
  assert.deepEqual(ctx.scopes, [ToolScopes.READ, ToolScopes.OPERATE]);
});

test("buildKomodoContext grants no scopes to a user without Komodo permissions", async () => {
  const ctx = await buildKomodoContext(
    fakeClient({ username: "nobody", enabled: true }),
    { type: "jwt", jwt: "j" },
    "password",
  );
  assert.deepEqual(ctx.scopes, []);
});

test("buildKomodoContext gives a Komodo admin every tier", async () => {
  const ctx = await buildKomodoContext(
    fakeClient({ username: "root", enabled: true, admin: true }),
    { type: "jwt", jwt: "j" },
    "password",
  );
  assert.deepEqual(ctx.scopes, [ToolScopes.READ, ToolScopes.OPERATE, ToolScopes.ADMIN]);
  assert.equal(ctx.identity.isAdmin, true);
});

test("buildKomodoContext refuses a disabled Komodo user", async () => {
  await assert.rejects(
    buildKomodoContext(fakeClient({ username: "gone", enabled: false }), { type: "jwt", jwt: "j" }, "password"),
    AuthenticationError,
  );
});

test("buildKomodoContext passes on Komodo's rejection of the credential", async () => {
  await assert.rejects(
    buildKomodoContext(
      fakeClient(AuthenticationError.invalidCredentials()),
      { type: "api-key", key: "K", secret: "S" },
      "api-key",
    ),
    AuthenticationError,
  );
});

test("buildKomodoContext records which registered client a service session belongs to", async () => {
  const ctx = await buildKomodoContext(
    fakeClient({ username: "svc", enabled: true, admin: true }),
    { type: "service" },
    "service-client",
    "gateway",
  );
  assert.equal(ctx.identity.oauthClientId, "gateway");
  assert.equal(ctx.identity.method, "service-client");
});

// ============================================================================
// Permission values as Komodo writes them
// ============================================================================

test("permissionLevelOf reads the bare level Komodo sends for a plain permission", () => {
  // What Komodo Core 2.3 answers `GetPermission` with for a non-admin — a string, not an object.
  assert.equal(permissionLevelOf(Types.PermissionLevel.Execute), Types.PermissionLevel.Execute);
  assert.equal(permissionLevelOf(Types.PermissionLevel.None), Types.PermissionLevel.None);
});

test("permissionLevelOf reads the level of a permission that carries specifics", () => {
  // What an admin gets, and any permission with resource-specific extras.
  const withSpecifics = { level: Types.PermissionLevel.Write, specific: [] } as Types.PermissionLevelAndSpecifics;
  assert.equal(permissionLevelOf(withSpecifics), Types.PermissionLevel.Write);
});

test("permissionLevelOf treats a missing permission as none", () => {
  assert.equal(permissionLevelOf(undefined), Types.PermissionLevel.None);
});

test("permissionLevelOf accepts every bare level (#217)", () => {
  for (const level of [
    Types.PermissionLevel.None,
    Types.PermissionLevel.Read,
    Types.PermissionLevel.Execute,
    Types.PermissionLevel.Write,
  ]) {
    assert.equal(permissionLevelOf(level), level);
  }
});

test("permissionLevelOf refuses unknown and malformed values without silently granting access (#217)", () => {
  const invalid = [null, "", "ADMIN", {}, { level: undefined }, { level: "SuperAdmin" }];
  for (const value of invalid) {
    assert.throws(() => permissionLevelOf(value), /Unexpected Komodo permission value/);
  }
});
