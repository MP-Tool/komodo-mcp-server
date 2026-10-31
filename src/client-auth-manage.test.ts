// mogh_auth_client accesses localStorage when komodo_client is imported.
import "./utils/polyfills.js";

import { test } from "node:test";
import assert from "node:assert/strict";
import { KomodoClient } from "./client.js";

test("API-key mode authenticates CreateApiKey on /auth/manage using both headers", async (t) => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init: RequestInit | undefined) => {
    calls.push({ url: typeof url === "string" ? url : url instanceof URL ? url.href : url.url, init });
    return Response.json({ key: "K_temporary", secret: "one-time-secret" });
  });

  const client = KomodoClient.connectWithApiKey("https://komodo.example.test/", "K_service", "service-secret");
  const result = await client.createApiKey("test-key", 1760000000000);

  assert.deepEqual(result, { key: "K_temporary", secret: "one-time-secret" });
  assert.equal(calls.length, 1);
  const request = calls[0];
  assert.ok(request);
  const init = request.init;
  assert.ok(init);
  assert.equal(request.url, "https://komodo.example.test/auth/manage/CreateApiKey");
  assert.equal(init.method, "POST");
  assert.equal(init.redirect, "error");
  assert.ok(init.signal instanceof AbortSignal);
  assert.deepEqual(init.headers, {
    "Content-Type": "application/json",
    "X-Api-Key": "K_service",
    "X-Api-Secret": "service-secret",
  });
  const body = init.body;
  assert.ok(typeof body === "string");
  assert.deepEqual(JSON.parse(body), {
    name: "test-key",
    expires: 1760000000000,
  });
});

test("API-key mode authenticates DeleteApiKey with the same service identity", async (t) => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init: RequestInit | undefined) => {
    calls.push({ url: typeof url === "string" ? url : url instanceof URL ? url.href : url.url, init });
    return Response.json({});
  });

  const client = KomodoClient.connectWithApiKey("https://komodo.example.test", "K_service", "service-secret");
  await client.deleteApiKey("K_temp");

  assert.equal(calls.length, 1);
  const request = calls[0];
  assert.ok(request);
  const init = request.init;
  assert.ok(init);
  assert.equal(request.url, "https://komodo.example.test/auth/manage/DeleteApiKey");
  const headers = init.headers as Record<string, string>;
  assert.equal(headers["X-Api-Key"], "K_service");
  assert.equal(headers["X-Api-Secret"], "service-secret");
  const body = init.body;
  assert.ok(typeof body === "string");
  assert.deepEqual(JSON.parse(body), { key: "K_temp" });
});

test("API-key management failures include HTTP status, not credential or response contents", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ error: "request echoed service-secret" }, { status: 403 }),
  );

  const client = KomodoClient.connectWithApiKey("https://komodo.example.test", "K_service", "service-secret");
  await assert.rejects(client.createApiKey("test-key", 0), (error: Error & { status?: number }) => {
    assert.equal(error.status, 403);
    assert.match(error.message, /CreateApiKey.*HTTP 403/);
    assert.ok(!error.message.includes("K_service"));
    assert.ok(!error.message.includes("service-secret"));
    return true;
  });
});

test("JWT sessions keep the SDK's native auth.manage path", async (t) => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request, init: RequestInit | undefined) => {
    calls.push({ url: typeof url === "string" ? url : url instanceof URL ? url.href : url.url, init });
    return Response.json({ key: "K_jwt", secret: "jwt-one-time-secret" });
  });

  const client = KomodoClient.connectWithJwt("https://komodo.example.test", "signed-jwt");
  const result = await client.createApiKey("from-jwt", 0);

  assert.equal(result.key, "K_jwt");
  assert.equal(calls.length, 1);
  const request = calls[0];
  assert.ok(request);
  assert.equal(request.url, "https://komodo.example.test/auth/manage/CreateApiKey");
  const headers = new Headers(request.init?.headers);
  assert.ok(!headers.has("X-Api-Key"));
  assert.ok(!headers.has("X-Api-Secret"));
  assert.ok(headers.get("authorization")?.includes("signed-jwt"));
});
