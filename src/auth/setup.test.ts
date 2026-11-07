// Must precede any komodo_client import — mogh_auth_client touches localStorage at module load.
import "../utils/polyfills.js";

import { test } from "node:test";
import assert from "node:assert/strict";
import { createClientAuthenticator } from "./setup.js";
import { komodoIdentity } from "./komodo-identity.js";
import type { KomodoSessionContext } from "./komodo-identity.js";
import { ToolScopes } from "../config/scopes.js";

// ============================================================================
// client_credentials routing — which Komodo user a machine client acts as.
//
// Two doors, and only two: a registered client acts as the [komodo] service
// account; anything else has to be a Komodo API key and acts as its own user.
// ============================================================================

const KEY = "K_aB3dE6gH9jK2mN5pQ8sT1vW4yZ7bC0eF3hJ6kL9n_K";
const SECRET = "S_zY8xW5vU2tS9rQ6pN3mL0kJ7hG4fE1dC8bA5zX2w_S";

function keySession(): KomodoSessionContext {
  return {
    scopes: [ToolScopes.READ],
    identity: {
      method: "api-key",
      komodoUserId: "reader-user",
      username: "reader",
      credential: { type: "api-key", key: KEY, secret: SECRET },
      isAdmin: false,
      canCreateServers: false,
      canCreateBuilds: false,
    },
  };
}

function serviceSession(clientId: string): KomodoSessionContext {
  return {
    scopes: [ToolScopes.READ, ToolScopes.OPERATE, ToolScopes.ADMIN],
    identity: {
      method: "service-client",
      komodoUserId: "service-account",
      username: "mcp-service",
      credential: { type: "service" },
      oauthClientId: clientId,
      isAdmin: true,
      canCreateServers: true,
      canCreateBuilds: true,
    },
  };
}

function setup() {
  const keyChecks: Array<[string, string]> = [];
  const serviceLookups: string[] = [];
  const authenticate = createClientAuthenticator({
    verifyApiKey: async (key, secret) => {
      keyChecks.push([key, secret]);
      return key === KEY && secret === SECRET ? keySession() : null;
    },
    serviceAccountContext: async (clientId) => {
      serviceLookups.push(clientId);
      return serviceSession(clientId);
    },
  });
  return { authenticate, keyChecks, serviceLookups };
}

test("a Komodo API key acts as the user it belongs to", async () => {
  const { authenticate, serviceLookups } = setup();
  const authInfo = await authenticate({ clientId: KEY, clientSecret: SECRET, scopes: [], purpose: "token" });

  assert.ok(authInfo);
  assert.equal(authInfo.clientId, "reader-user");
  assert.deepEqual(authInfo.scopes, [ToolScopes.READ]);
  assert.equal(komodoIdentity.read(authInfo)?.credential.type, "api-key");
  assert.equal(serviceLookups.length, 0, "an API key never reaches for the service account");
});

test("a wrong API secret is rejected", async () => {
  const { authenticate } = setup();
  assert.equal(await authenticate({ clientId: KEY, clientSecret: "S_wrong_S", scopes: [], purpose: "token" }), null);
});

test("a registered client acts as the [komodo] service account", async () => {
  const { authenticate, keyChecks, serviceLookups } = setup();
  const authInfo = await authenticate({
    clientId: "gateway",
    registered: { id: "gateway" },
    scopes: [],
    purpose: "token",
  });

  assert.ok(authInfo);
  const identity = komodoIdentity.read(authInfo);
  assert.ok(identity);
  assert.equal(identity.method, "service-client");
  assert.deepEqual(identity.credential, { type: "service" });
  assert.equal(identity.oauthClientId, "gateway");
  assert.equal(authInfo.clientId, "service-client:gateway");
  assert.deepEqual(serviceLookups, ["gateway"]);
  assert.equal(keyChecks.length, 0, "a registered client's secret is the framework's business");
});

test("an unregistered client that is not a valid API key gets nothing", async () => {
  const { authenticate, serviceLookups } = setup();
  assert.equal(await authenticate({ clientId: "gateway", clientSecret: "guess", scopes: [], purpose: "token" }), null);
  assert.equal(await authenticate({ clientId: "admin", clientSecret: "admin", scopes: [], purpose: "token" }), null);
  assert.equal(serviceLookups.length, 0, "the service account is reachable through a registered client only");
});

test("a request with neither a registered client nor a secret is rejected", async () => {
  const { authenticate, keyChecks, serviceLookups } = setup();
  assert.equal(await authenticate({ clientId: KEY, scopes: [], purpose: "token" }), null);
  assert.equal(keyChecks.length, 0);
  assert.equal(serviceLookups.length, 0);
});

test("a service account that cannot be resolved fails the request instead of falling back", async () => {
  const authenticate = createClientAuthenticator({
    verifyApiKey: async () => keySession(),
    serviceAccountContext: async () => {
      throw new Error("Komodo client not connected");
    },
  });
  await assert.rejects(
    authenticate({ clientId: "gateway", registered: { id: "gateway" }, scopes: [], purpose: "token" }),
    /not connected/,
  );
});

test("a client that only revokes a token is verified the same way — a wrong secret is still rejected", async () => {
  const { authenticate, keyChecks } = setup();
  assert.ok(await authenticate({ clientId: KEY, clientSecret: SECRET, scopes: [], purpose: "revocation" }));
  assert.equal(
    await authenticate({ clientId: KEY, clientSecret: "S_wrong_S", scopes: [], purpose: "revocation" }),
    null,
  );
  assert.equal(keyChecks.length, 2, "both attempts were put to Komodo");
});
