// Must precede any komodo_client import — mogh_auth_client touches localStorage at module load.
import "../utils/polyfills.js";

import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { exchangeIdTokenForKomodoJwt, KomodoExchangeError, probeTokenExchange } from "./sso.js";
import { ConnectionError } from "../errors/index.js";

// ============================================================================
// The token exchange with Komodo Core (RFC 8693) — what is sent, and how each
// answer Komodo can give is read. The sign-in as a whole is covered end to end
// in e2e/auth.e2e.mjs.
// ============================================================================

interface Received {
  method: string | undefined;
  path: string | undefined;
  contentType: string | undefined;
  form: URLSearchParams;
}

/** A Komodo Core stand-in that answers every request with the given status and body. */
async function komodoAnswering(
  status: number,
  body: unknown,
  contentType = "application/json",
): Promise<{ url: string; received: Received[] }> {
  const received: Received[] = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += String(chunk)));
    req.on("end", () => {
      received.push({
        method: req.method,
        path: req.url,
        contentType: req.headers["content-type"],
        form: new URLSearchParams(raw),
      });
      res.writeHead(status, contentType ? { "content-type": contentType } : {});
      res.end(typeof body === "string" ? body : JSON.stringify(body));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  after(() => {
    server.closeAllConnections();
    server.close();
  });
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, received };
}

const ISSUED = {
  access_token: "komodo.jwt.value",
  issued_token_type: "urn:ietf:params:oauth:token-type:access_token",
  token_type: "Bearer",
  expires_in: 86400,
};

test("the ID token is sent as an RFC 8693 token exchange to Komodo's token endpoint", async () => {
  const komodo = await komodoAnswering(200, ISSUED);

  const jwt = await exchangeIdTokenForKomodoJwt(`${komodo.url}/`, "the.id.token");

  assert.equal(jwt, "komodo.jwt.value");
  const [request] = komodo.received;
  assert.ok(request);
  assert.equal(request.method, "POST");
  assert.equal(request.path, "/auth/token");
  assert.equal(request.contentType, "application/x-www-form-urlencoded");
  assert.deepEqual(Object.fromEntries(request.form), {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
    subject_token: "the.id.token",
    subject_token_type: "urn:ietf:params:oauth:token-type:id_token",
    requested_token_type: "urn:ietf:params:oauth:token-type:access_token",
  });
});

test("an answer that is not a bearer token for Komodo's API is not used", async () => {
  for (const answer of [
    { ...ISSUED, access_token: "" },
    { ...ISSUED, access_token: undefined },
    { ...ISSUED, token_type: "N_A" },
    { ...ISSUED, issued_token_type: "urn:ietf:params:oauth:token-type:refresh_token" },
    "<html>signed in</html>",
  ]) {
    const komodo = await komodoAnswering(200, answer, typeof answer === "string" ? "text/html" : "application/json");
    await assert.rejects(exchangeIdTokenForKomodoJwt(komodo.url, "the.id.token"), ConnectionError);
  }
});

test("a token Komodo refuses is reported as rejected, with Komodo's reason kept for the log", async () => {
  const komodo = await komodoAnswering(400, { error: "invalid_grant", error_description: "No user is linked" });

  await assert.rejects(exchangeIdTokenForKomodoJwt(komodo.url, "the.id.token"), (error: unknown) => {
    assert.ok(error instanceof KomodoExchangeError);
    assert.equal(error.kind, "rejected");
    assert.equal(error.detail, "No user is linked");
    return true;
  });
});

test("a Komodo that cannot exchange what was sent is reported as unsupported", async () => {
  for (const [status, body] of [
    [400, { error: "unsupported_grant_type", error_description: "nope" }],
    [400, { error: "invalid_request", error_description: "'subject_token_type' must be …" }],
    [405, ""],
    [404, ""],
  ] as const) {
    const komodo = await komodoAnswering(status, body, body === "" ? "" : "application/json");
    await assert.rejects(exchangeIdTokenForKomodoJwt(komodo.url, "the.id.token"), (error: unknown) => {
      assert.ok(error instanceof KomodoExchangeError, `status ${status}`);
      assert.equal(error.kind, "unsupported");
      return true;
    });
  }
});

test("trouble on Komodo's side is neither a refusal nor a missing feature", async () => {
  for (const [status, body] of [
    [503, { error: "temporarily_unavailable" }],
    [429, { error: "Too many requests" }],
    [502, "<html>bad gateway</html>"],
  ] as const) {
    const komodo = await komodoAnswering(status, body, typeof body === "string" ? "text/html" : "application/json");
    await assert.rejects(exchangeIdTokenForKomodoJwt(komodo.url, "the.id.token"), ConnectionError);
  }
  await assert.rejects(exchangeIdTokenForKomodoJwt("http://127.0.0.1:1", "the.id.token"), ConnectionError);
});

test("the probe recognises a Komodo with the exchange by its OAuth error answer", async () => {
  const komodo = await komodoAnswering(400, {
    error: "invalid_request",
    error_description: "'subject_token' is empty",
  });

  assert.equal(await probeTokenExchange(komodo.url), "available");
  // Nothing that could be exchanged was sent.
  assert.deepEqual(Object.fromEntries(komodo.received[0]?.form ?? []), {
    grant_type: "urn:ietf:params:oauth:grant-type:token-exchange",
  });
});

test("the probe recognises a Komodo without the exchange", async () => {
  // Komodo Core 2.3 answers the unknown route with 405 and no body.
  assert.equal(await probeTokenExchange((await komodoAnswering(405, "", "")).url), "unavailable");
  assert.equal(await probeTokenExchange((await komodoAnswering(404, { message: "not found" })).url), "unavailable");
  // Its web UI answers what no API route claims.
  assert.equal(
    await probeTokenExchange((await komodoAnswering(200, "<html>ui</html>", "text/html")).url),
    "unavailable",
  );
});

test("Komodo's ordinary error format is not mistaken for the token endpoint", async () => {
  // Every Komodo API error is JSON with an `error` string — a sentence, with a trace.
  const ordinary = { error: "unknown variant `token`, expected one of `GetLoginOptions`, …", trace: [] };
  assert.equal(await probeTokenExchange((await komodoAnswering(400, ordinary)).url), "unavailable");
  assert.equal(
    await probeTokenExchange((await komodoAnswering(404, { error: "Not found", trace: [] })).url),
    "unavailable",
  );

  await assert.rejects(
    exchangeIdTokenForKomodoJwt((await komodoAnswering(400, ordinary)).url, "the.id.token"),
    (error: unknown) => error instanceof KomodoExchangeError && error.kind === "unsupported",
  );
});

test("the probe does not conclude anything from an answer that says nothing about the endpoint", async () => {
  assert.equal(await probeTokenExchange("http://127.0.0.1:1"), "unknown");
  for (const [status, body] of [
    [502, "<html>bad gateway</html>"],
    [429, { error: "Too many requests", trace: [] }],
    [401, { error: "Invalid client credentials", trace: [] }],
    [403, "<html>forbidden by the proxy</html>"],
  ] as const) {
    const komodo = await komodoAnswering(status, body, typeof body === "string" ? "text/html" : "application/json");
    assert.equal(await probeTokenExchange(komodo.url), "unknown", `HTTP ${status}`);
  }
});
