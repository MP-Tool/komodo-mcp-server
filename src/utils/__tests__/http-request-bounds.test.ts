import "../polyfills.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { AuthorizationError, OperationCancelledError } from "mcp-server-framework";
import { createKomodoApi, KomodoClient } from "../../client.js";
import { config } from "../../config/index.js";
import { ApiError, AuthenticationError, ConnectionError } from "../../errors/index.js";
import { wrapApiCall } from "../api-helpers.js";

const url = "http://core.invalid";

function createApi() {
  return createKomodoApi(url, { type: "jwt", jwt: "fixture-jwt" }, () => "2001:db8::1");
}

function stalledHeaders(signal: AbortSignal | null | undefined): Promise<Response> {
  assert.ok(signal);
  return new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Request aborted", "AbortError")), { once: true });
  });
}

function stalledBody(signal: AbortSignal | null | undefined, status: number): Response {
  assert.ok(signal);
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"version":'));
        signal.addEventListener("abort", () => controller.error(signal.reason), { once: true });
      },
    }),
    { status },
  );
}

for (const kind of ["read", "write", "execute"] as const) {
  test(`a stalled ${kind} is aborted at the configured timeout`, { timeout: 1_000 }, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const fetch = t.mock.method(globalThis, "fetch", (_url: string, init?: RequestInit) =>
      stalledHeaders(init?.signal),
    );
    const api = createApi();
    const calls = {
      read: () => api.read("GetVersion", {}),
      write: () => api.write("DeleteAction", { id: "fixture" }),
      execute: () => api.execute("RunAction", { action: "fixture" }),
    };
    const result = wrapApiCall(kind, calls[kind] as () => Promise<unknown>);
    const rejected = assert.rejects(result, { name: ConnectionError.name, message: /timed out/i });
    t.mock.timers.tick(config.KOMODO_API_TIMEOUT_MS);
    await rejected;
    assert.equal(fetch.mock.callCount(), 1);
  });
}

for (const [status, errorType] of [
  [200, ConnectionError],
  [401, AuthenticationError],
  [403, AuthorizationError],
] as const) {
  test(`a stalled HTTP ${status} response body is aborted and classified`, { timeout: 1_000 }, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let signal: AbortSignal | null | undefined;
    t.mock.method(globalThis, "fetch", async (_url: string, init?: RequestInit) => {
      signal = init?.signal;
      return stalledBody(signal, status);
    });
    const rejected = assert.rejects(
      wrapApiCall("version", () => createApi().read("GetVersion", {})),
      errorType,
    );
    await setImmediate();
    t.mock.timers.tick(config.KOMODO_API_TIMEOUT_MS);
    await rejected;
    assert.equal(signal?.aborted, true);
  });
}

test("the background health check reports a timeout without an MCP caller", { timeout: 1_000 }, async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(globalThis, "fetch", (_url: string, init?: RequestInit) => stalledHeaders(init?.signal));
  const pending = KomodoClient.connectWithApiKey(url, "fixture", "fixture").healthCheck();
  t.mock.timers.tick(config.KOMODO_API_TIMEOUT_MS);
  const health = await pending;
  assert.equal(health.healthy, false);
  assert.match(health.error ?? "", /timed out/i);
});

test("cancelling one in-flight call leaves the other caller's signal, headers and result intact", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const requests: { signal: AbortSignal; headers: Headers }[] = [];
  let lateResponse: ((response: Response) => void) | undefined;
  t.mock.method(globalThis, "fetch", async (_url: string, init?: RequestInit) => {
    const signal = init?.signal;
    assert.ok(signal);
    requests.push({ signal, headers: new Headers(init.headers) });
    if (requests.length === 1) {
      // Model a response that is already on its way when the client aborts.
      return new Promise<Response>((resolve) => {
        lateResponse = resolve;
      });
    }
    return Response.json({ version: "2.3.4" });
  });
  const cancelledCaller = new AbortController();
  const otherCaller = new AbortController();
  const api = createApi();
  const cancelled = wrapApiCall("cancelled", () => api.read("GetVersion", {}), cancelledCaller.signal);
  const rejected = assert.rejects(cancelled, OperationCancelledError);
  const other = wrapApiCall("other", () => api.read("GetVersion", {}), otherCaller.signal);
  cancelledCaller.abort(new Error("client stopped"));
  assert.ok(lateResponse);
  lateResponse(Response.json({ version: "late" }));
  await rejected;
  assert.deepEqual(await other, { version: "2.3.4" });
  t.mock.timers.tick(config.KOMODO_API_TIMEOUT_MS);
  assert.deepEqual(
    requests.map(({ signal }) => signal.aborted),
    [true, false],
    "the completed call cleared its timer",
  );
  for (const request of requests) {
    assert.equal(request.headers.get("authorization"), "fixture-jwt");
    assert.equal(request.headers.get("forwarded"), 'for="[2001:db8::1]"');
    assert.equal(request.headers.get("x-forwarded-for"), "2001:db8::1");
  }
});

test(
  "pre-cancellation sends nothing and in-flight cancellation interrupts a stalled response",
  { timeout: 1_000 },
  async (t) => {
    const fetch = t.mock.method(globalThis, "fetch", (_url: string, init?: RequestInit) =>
      stalledHeaders(init?.signal),
    );
    const api = createApi();
    const caller = new AbortController();
    const read = () => api.read("GetVersion", {});
    await assert.rejects(wrapApiCall("version", read, AbortSignal.abort()), OperationCancelledError);
    assert.equal(fetch.mock.callCount(), 0);
    const rejected = assert.rejects(wrapApiCall("version", read, caller.signal), OperationCancelledError);
    assert.equal(fetch.mock.callCount(), 1);
    caller.abort();
    await rejected;
  },
);

test("Komodo errors retain their existing classification and API-key headers", async (t) => {
  const api = createKomodoApi(url, { type: "api-key", key: "fixture-key", secret: "fixture-secret" }, () => undefined);
  const responses = [
    Response.json({ error: "invalid credential" }, { status: 401 }),
    Response.json({ error: "permission denied" }, { status: 500 }),
    Response.json({ error: "missing resource" }, { status: 404 }),
    new Response("malformed JSON"),
  ];
  t.mock.method(globalThis, "fetch", async (_url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("x-api-key"), "fixture-key");
    assert.equal(headers.get("x-api-secret"), "fixture-secret");
    const response = responses.shift();
    assert.ok(response);
    return response;
  });
  const read = () => wrapApiCall("version", () => api.read("GetVersion", {}));
  await assert.rejects(read(), AuthenticationError);
  await assert.rejects(read(), AuthorizationError);
  await assert.rejects(read(), { name: ApiError.name, apiStatusCode: 404 });
  await assert.rejects(read(), ApiError);
});
