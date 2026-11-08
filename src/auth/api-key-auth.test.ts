// Must precede any komodo_client import — mogh_auth_client touches localStorage at module load.
import "../utils/polyfills.js";

import { test } from "node:test";
import assert from "node:assert/strict";
import { createApiKeyHeaderAuthenticator, isKomodoApiKey, isKomodoApiSecret, verifyApiKey } from "./api-key-auth.js";
import { komodoIdentity } from "./komodo-identity.js";
import type { KomodoSessionContext } from "./komodo-identity.js";
import { ToolScopes } from "../config/scopes.js";

// A key and secret in the shape Komodo Core mints (K_/S_ + 40 alphanumeric characters).
const KEY = "K_aB3dE6gH9jK2mN5pQ8sT1vW4yZ7bC0eF3hJ6kL9n_K";
const SECRET = "S_zY8xW5vU2tS9rQ6pN3mL0kJ7hG4fE1dC8bA5zX2w_S";
const OTHER_SECRET = "S_0000000000000000000000000000000000000000_S";

// ============================================================================
// Format
// ============================================================================

// The shape Komodo 1.x minted (K-/S- + 40 alphanumeric characters) — still valid after an upgrade.
const LEGACY_KEY = "K-aB3dE6gH9jK2mN5pQ8sT1vW4yZ7bC0eF3hJ6kL9n";
const LEGACY_SECRET = "S-zY8xW5vU2tS9rQ6pN3mL0kJ7hG4fE1dC8bA5zX2w";

test("recognises keys and secrets as Komodo mints them", () => {
  assert.equal(isKomodoApiKey(KEY), true);
  assert.equal(isKomodoApiSecret(SECRET), true);
});

test("recognises keys and secrets minted by Komodo 1.x", () => {
  // A pre-check stricter than Komodo itself would turn away valid keys without ever asking.
  assert.equal(isKomodoApiKey(LEGACY_KEY), true);
  assert.equal(isKomodoApiSecret(LEGACY_SECRET), true);
});

test("does not take a secret for a key or the other way round", () => {
  assert.equal(isKomodoApiKey(SECRET), false);
  assert.equal(isKomodoApiSecret(KEY), false);
  assert.equal(isKomodoApiKey(LEGACY_SECRET), false);
  assert.equal(isKomodoApiSecret(LEGACY_KEY), false);
});

test("rejects anything that is not shaped like a Komodo key", () => {
  const junk = [
    "",
    "admin",
    "K__K",
    "K_short_K",
    `${KEY} `,
    `${KEY}\n`,
    KEY.replace("_K", ""),
    "K_" + "a".repeat(200) + "_K",
    "K_has-dash-in-the-middle-of-it_K",
    "K_aB3dE6gH9jK2mN5pQ8sT1vW4yZ7bC0eF3hJ6kL9n_K' OR '1'='1",
    "K-short",
    "K-has_underscore_in_the_middle_of_it",
    `${LEGACY_KEY}_K`, // the two generations do not mix
    `${LEGACY_KEY} `,
  ];
  for (const value of junk) assert.equal(isKomodoApiKey(value), false, JSON.stringify(value));
});

// ============================================================================
// verifyApiKey — malformed input never reaches Komodo
// ============================================================================

test("verifyApiKey turns down malformed credentials without contacting Komodo", async () => {
  // Port 1 on loopback: a real attempt would fail with a connection error, not resolve null.
  const unreachable = "http://127.0.0.1:1";
  assert.equal(await verifyApiKey(unreachable, "admin", "password"), null);
  assert.equal(await verifyApiKey(unreachable, KEY, "not-a-secret"), null);
  assert.equal(await verifyApiKey(unreachable, "not-a-key", SECRET), null);
});

// ============================================================================
// X-Api-Key / X-Api-Secret request authenticator
// ============================================================================

function session(username = "deploy-bot"): KomodoSessionContext {
  return {
    scopes: [ToolScopes.READ, ToolScopes.OPERATE],
    identity: {
      method: "api-key",
      komodoUserId: "user-1",
      username,
      credential: { type: "api-key", key: KEY, secret: SECRET },
      isAdmin: false,
      canCreateServers: false,
      canCreateBuilds: false,
    },
  };
}

/** A verifier double: accepts exactly KEY + SECRET and counts how often Komodo would be asked. */
function verifier() {
  const calls: Array<[string, string]> = [];
  const verify = async (key: string, secret: string): Promise<KomodoSessionContext | null> => {
    calls.push([key, secret]);
    return key === KEY && secret === SECRET ? session() : null;
  };
  return { verify, calls };
}

test("is responsible only for requests that carry an X-Api-Key header", () => {
  const authenticator = createApiKeyHeaderAuthenticator(verifier().verify);
  assert.notEqual(authenticator.credential({ "x-api-key": KEY }), undefined);
  assert.equal(authenticator.credential({}), undefined);
  assert.equal(authenticator.credential({ "x-api-key": "   " }), undefined);
  assert.equal(authenticator.credential({ authorization: "Bearer token" }), undefined);
  // A header sent twice arrives as an array — not a credential this scheme understands.
  assert.equal(authenticator.credential({ "x-api-key": [KEY, KEY] }), undefined);
});

test("identifies the credential by key and secret together", () => {
  // The lockout counts different wrong credentials: another secret for the same key is another
  // guess, the same pair sent again is not.
  const authenticator = createApiKeyHeaderAuthenticator(verifier().verify);
  const pair = authenticator.credential({ "x-api-key": KEY, "x-api-secret": SECRET });
  assert.equal(authenticator.credential({ "x-api-key": KEY, "x-api-secret": SECRET }), pair);
  assert.notEqual(authenticator.credential({ "x-api-key": KEY, "x-api-secret": "S-other" }), pair);
  assert.notEqual(authenticator.credential({ "x-api-key": KEY }), pair);
});

test("authenticates a valid key as the Komodo user it belongs to", async () => {
  const { verify } = verifier();
  const authInfo = await createApiKeyHeaderAuthenticator(verify).authenticate({
    "x-api-key": KEY,
    "x-api-secret": SECRET,
  });

  assert.ok(authInfo);
  assert.equal(authInfo.clientId, "user-1");
  assert.deepEqual(authInfo.scopes, [ToolScopes.READ, ToolScopes.OPERATE]);
  assert.equal(komodoIdentity.read(authInfo)?.username, "deploy-bot");
});

test("rejects a key without a secret — without asking Komodo", async () => {
  const { verify, calls } = verifier();
  const authenticator = createApiKeyHeaderAuthenticator(verify);
  assert.equal(await authenticator.authenticate({ "x-api-key": KEY }), null);
  assert.equal(await authenticator.authenticate({ "x-api-key": KEY, "x-api-secret": "  " }), null);
  assert.equal(calls.length, 0);
});

test("rejects a wrong secret", async () => {
  const { verify } = verifier();
  const result = await createApiKeyHeaderAuthenticator(verify).authenticate({
    "x-api-key": KEY,
    "x-api-secret": OTHER_SECRET,
  });
  assert.equal(result, null);
});

test("trims surrounding whitespace from the header values", async () => {
  const { verify, calls } = verifier();
  const result = await createApiKeyHeaderAuthenticator(verify).authenticate({
    "x-api-key": ` ${KEY} `,
    "x-api-secret": ` ${SECRET} `,
  });
  assert.ok(result);
  assert.deepEqual(calls[0], [KEY, SECRET]);
});

test("asks Komodo once per minute for a key in use, not on every request", async () => {
  const { verify, calls } = verifier();
  let clock = 1_000_000;
  const authenticator = createApiKeyHeaderAuthenticator(verify, () => clock);
  const headers = { "x-api-key": KEY, "x-api-secret": SECRET };

  await authenticator.authenticate(headers);
  clock += 59_000;
  await authenticator.authenticate(headers);
  assert.equal(calls.length, 1, "second request within the window is served from the cache");

  clock += 2_000; // 61 s after the verification
  await authenticator.authenticate(headers);
  assert.equal(calls.length, 2, "the key is verified again once the window has passed");
});

test("keeps re-verifying on schedule even while the key is in constant use", async () => {
  // The window is counted from the verification, not from the last request — otherwise a
  // busy client would never be re-checked.
  const { verify, calls } = verifier();
  let clock = 0;
  const authenticator = createApiKeyHeaderAuthenticator(verify, () => clock);
  const headers = { "x-api-key": KEY, "x-api-secret": SECRET };

  for (let i = 0; i < 130; i++) {
    await authenticator.authenticate(headers);
    clock += 1_000;
  }
  assert.equal(calls.length, 3); // at 0 s, 60 s and 120 s
});

test("a cached key does not vouch for a different secret", async () => {
  const { verify, calls } = verifier();
  const authenticator = createApiKeyHeaderAuthenticator(verify);

  assert.ok(await authenticator.authenticate({ "x-api-key": KEY, "x-api-secret": SECRET }));
  assert.equal(await authenticator.authenticate({ "x-api-key": KEY, "x-api-secret": OTHER_SECRET }), null);
  assert.equal(calls.length, 2);
});

test("failed verifications are never cached", async () => {
  const { verify, calls } = verifier();
  const authenticator = createApiKeyHeaderAuthenticator(verify);
  const headers = { "x-api-key": KEY, "x-api-secret": OTHER_SECRET };

  await authenticator.authenticate(headers);
  await authenticator.authenticate(headers);
  assert.equal(calls.length, 2);
});

test("a Komodo outage surfaces as an error, not as a rejected key", async () => {
  const authenticator = createApiKeyHeaderAuthenticator(async () => {
    throw new Error("Komodo unreachable");
  });
  await assert.rejects(authenticator.authenticate({ "x-api-key": KEY, "x-api-secret": SECRET }), /unreachable/);
});
