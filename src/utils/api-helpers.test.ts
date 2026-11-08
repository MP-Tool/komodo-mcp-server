// Must precede any komodo_client import — mogh_auth_client touches localStorage at module load.
import "./polyfills.js";

import { test } from "node:test";
import assert from "node:assert/strict";
import { Types } from "komodo_client";
import { clientForAuth, effectivePermissionLevel } from "./api-helpers.js";
import type { KomodoClientSources, PermissionReader } from "./api-helpers.js";
import { komodoIdentity } from "../auth/komodo-identity.js";
import type { KomodoIdentity } from "../auth/komodo-identity.js";
import type { KomodoClient, KomodoUserCredential } from "../client.js";
import { ClientNotConfiguredError } from "../errors/index.js";

// ============================================================================
// Which Komodo client may a request use?
//
// This is the guard around the server's own [komodo] credentials. They serve
// anonymous requests (stdio, or auth-disabled HTTP where the framework has
// already made anonymous callers read-only) and registered service clients —
// and nobody else, whatever the configuration.
// ============================================================================

const GLOBAL = { label: "global" } as unknown as KomodoClient;

/** Client sources that record what was asked of them. */
function sources(options: { globalConnected?: boolean; anonymousMode?: boolean } = {}) {
  const userCredentials: KomodoUserCredential[] = [];
  const result: KomodoClientSources = {
    global: () => (options.globalConnected === false ? null : GLOBAL),
    servesAnonymous: () => options.anonymousMode !== false,
    user: (credential) => {
      userCredentials.push(credential);
      return { label: "user", credential } as unknown as KomodoClient;
    },
  };
  return { sources: result, userCredentials };
}

function authWith(overrides: Partial<KomodoIdentity>): { extra: Record<string, unknown> } {
  return {
    extra: komodoIdentity.write({
      method: "password",
      komodoUserId: "u1",
      username: "alice",
      credential: { type: "jwt", jwt: "alice-jwt" },
      isAdmin: false,
      canCreateServers: false,
      canCreateBuilds: false,
      ...overrides,
    }),
  };
}

test("an anonymous request uses the global connection", () => {
  const { sources: s } = sources();
  assert.equal(clientForAuth(undefined, s), GLOBAL);
});

test("an anonymous request fails when no global connection exists", () => {
  const { sources: s } = sources({ globalConnected: false });
  assert.throws(() => clientForAuth(undefined, s), ClientNotConfiguredError);
});

test("with authentication on, an unauthenticated request never gets the global connection", () => {
  // The global connection exists here (registered service clients need it), and the request
  // carries no authentication — a state the auth middleware should make impossible. If it
  // ever happens, the service account must stay out of reach.
  const { sources: s, userCredentials } = sources({ anonymousMode: false, globalConnected: true });
  assert.throws(() => clientForAuth(undefined, s), ClientNotConfiguredError);
  assert.equal(userCredentials.length, 0);
});

test("with authentication on, a registered service client still uses the global connection", () => {
  const { sources: s } = sources({ anonymousMode: false });
  const auth = authWith({ method: "service-client", credential: { type: "service" }, oauthClientId: "gateway" });
  assert.equal(clientForAuth(auth, s), GLOBAL);
});

test("a password session uses its own JWT, never the global connection", () => {
  const { sources: s, userCredentials } = sources();
  const client = clientForAuth(authWith({}), s);

  assert.notEqual(client, GLOBAL);
  assert.deepEqual(userCredentials, [{ type: "jwt", jwt: "alice-jwt" }]);
});

test("an API-key session uses its own key, never the global connection", () => {
  const { sources: s, userCredentials } = sources();
  const credential = { type: "api-key", key: "K_key_K", secret: "S_secret_S" } as const;
  const client = clientForAuth(authWith({ method: "api-key", credential }), s);

  assert.notEqual(client, GLOBAL);
  assert.deepEqual(userCredentials, [credential]);
});

test("a registered service client uses the global connection", () => {
  const { sources: s, userCredentials } = sources();
  const auth = authWith({ method: "service-client", credential: { type: "service" }, oauthClientId: "gateway" });

  assert.equal(clientForAuth(auth, s), GLOBAL);
  assert.equal(userCredentials.length, 0);
});

test("a registered service client fails — rather than degrading — while Komodo is disconnected", () => {
  const { sources: s } = sources({ globalConnected: false });
  const auth = authWith({ method: "service-client", credential: { type: "service" }, oauthClientId: "gateway" });
  assert.throws(() => clientForAuth(auth, s), ClientNotConfiguredError);
});

test("a user session cannot reach the global connection by claiming a service credential", () => {
  // Defence in depth: `auth.extra` is produced server-side, so this shape should never
  // occur. If it ever does, it must not become a way to act as the service account.
  for (const method of ["password", "api-key"] as const) {
    const { sources: s } = sources();
    const auth = authWith({ method, credential: { type: "service" } });
    assert.throws(() => clientForAuth(auth, s), ClientNotConfiguredError, method);
  }
});

test("an authenticated request without a Komodo identity gets no client at all", () => {
  // Authenticated to the MCP server, but nothing ties the request to a Komodo user.
  // Falling back to the global credentials here would hand out the service account.
  const { sources: s, userCredentials } = sources();
  for (const auth of [{}, { extra: {} }, { extra: { komodoUserId: "u1" } }, { extra: { komodoJwt: "legacy" } }]) {
    assert.throws(() => clientForAuth(auth, s), ClientNotConfiguredError, JSON.stringify(auth));
  }
  assert.equal(userCredentials.length, 0);
});

// ============================================================================
// Which permission does the caller hold on a resource?
//
// The pre-check has to see what Komodo will enforce — no less (it would let a
// call through only to fail) and, above all, no more strictly (it would turn a
// user away from resources they were given).
// ============================================================================

const { Read, Execute, Write, None } = Types.PermissionLevel;
const APP_ID = "6a0b8d539b662259d5ae36d4";

/**
 * A Komodo that behaves like Core 2.3: asked by id it weighs the grant on that resource,
 * asked by anything else it reports the base level for the resource kind.
 */
function komodoWith(options: { grants?: Record<string, Types.PermissionLevel>; base?: Types.PermissionLevel } = {}) {
  const asked: Types.ResourceTarget[] = [];
  const lookedUp: string[] = [];
  const reader: PermissionReader = {
    getPermission: async (target) => {
      asked.push(target);
      return options.grants?.[target.id] ?? options.base ?? None;
    },
    findResourceId: async (_type, name) => {
      lookedUp.push(name);
      return name === "app" ? APP_ID : undefined;
    },
  };
  return { reader, asked, lookedUp };
}

test("a resource named by the caller is checked by its id, where per-resource grants count", async () => {
  // The user may only Read deployments in general, but was given Execute on this one.
  const { reader, asked } = komodoWith({ base: Read, grants: { [APP_ID]: Execute } });

  assert.equal(await effectivePermissionLevel(reader, { type: "Deployment", id: "app" }), Execute);
  assert.deepEqual(asked, [{ type: "Deployment", id: APP_ID }]);
});

test("a resource given by id is checked as it is, without a lookup", async () => {
  const { reader, asked, lookedUp } = komodoWith({ grants: { [APP_ID]: Write } });

  assert.equal(await effectivePermissionLevel(reader, { type: "Deployment", id: APP_ID }), Write);
  assert.equal(lookedUp.length, 0);
  assert.deepEqual(asked, [{ type: "Deployment", id: APP_ID }]);
});

test("a name the caller cannot see is passed to Komodo unchanged", async () => {
  // Komodo then reports the base level — or that there is no such resource.
  const { reader, asked } = komodoWith({ base: Read });

  assert.equal(await effectivePermissionLevel(reader, { type: "Deployment", id: "unknown" }), Read);
  assert.deepEqual(asked, [{ type: "Deployment", id: "unknown" }]);
});

test("both forms of Komodo's answer are understood", async () => {
  // Bare level for a plain permission; `{ level, specific }` for admins and permissions with extras.
  const bare: PermissionReader = { getPermission: async () => Execute, findResourceId: async () => undefined };
  const object: PermissionReader = {
    getPermission: async () => ({ level: Write, specific: [] }),
    findResourceId: async () => undefined,
  };

  assert.equal(await effectivePermissionLevel(bare, { type: "Server", id: APP_ID }), Execute);
  assert.equal(await effectivePermissionLevel(object, { type: "Server", id: APP_ID }), Write);
});

test("no permission stays no permission", async () => {
  const { reader } = komodoWith();
  assert.equal(await effectivePermissionLevel(reader, { type: "Deployment", id: "app" }), None);
});
