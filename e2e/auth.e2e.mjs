// End-to-end checks of the authentication surface: the real komodo-mcp-server process
// (build/index.js) against a Komodo Core stand-in.
//
// Run with `npm run test:e2e`. Covers every way a client can authenticate, and the
// behaviour that must not change: stdio, the browser login, and — above all — that a
// network caller without a credential never gets to write (GHSA-gf32-w3f6-crx6).
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ClientCredentialsProvider, PrivateKeyJwtProvider } from "@modelcontextprotocol/sdk/client/auth-extensions.js";
import { auth } from "@modelcontextprotocol/sdk/client/auth.js";
import { startFakeKomodo, USERS } from "./fake-komodo.mjs";
import { startFakeOidc } from "./fake-oidc.mjs";
import { browserPath, launchBrowser } from "./browser.mjs";
import { clientAssertion, dpopProof, loopbackCertificate, newKey, rememberNonce, startSite } from "./keys.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_ENTRY = path.join(REPO, "build", "index.js");
if (!fs.existsSync(SERVER_ENTRY)) {
  console.error("build/index.js not found — run `npm run build` first (or use `npm run test:e2e`).");
  process.exit(2);
}
// The server looks for a config file in its working directory. Run it in an empty one so a
// developer's local config.toml cannot change what is being tested.
const WORKDIR = fs.mkdtempSync(path.join(os.tmpdir(), "komodo-mcp-e2e-"));

// ── tiny test harness ────────────────────────────────────────────────────────
const results = [];
let current = "";
function check(name, condition, detail = "") {
  results.push({ group: current, name, ok: Boolean(condition), detail });
  console.log(`  ${condition ? "PASS" : "FAIL"}  ${name}${condition ? "" : `   ← ${detail}`}`);
}
async function group(name, fn) {
  current = name;
  console.log(`\n■ ${name}`);
  try {
    await fn();
  } catch (error) {
    check("scenario completed without an unexpected error", false, error?.stack ?? String(error));
  }
}

// ── process management ───────────────────────────────────────────────────────
const freePort = () =>
  new Promise((resolve) => {
    const s = net.createServer().listen(0, "127.0.0.1", () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
  });

const BASE_ENV = { PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: "production", LOG_LEVEL: "info" };

/** Starts the MCP server over HTTP. Resolves once it answers, or with the exit info if it dies. */
async function startMcp(env) {
  const port = await freePort();
  const child = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: WORKDIR,
    env: { ...BASE_ENV, MCP_TRANSPORT: "http", MCP_BIND_HOST: "127.0.0.1", MCP_PORT: String(port), ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  const exited = new Promise((resolve) => child.on("exit", (code) => resolve(code)));
  const base = `http://127.0.0.1:${port}`;

  for (let i = 0; i < 100; i++) {
    const code = await Promise.race([exited, new Promise((r) => setTimeout(() => r(undefined), 100))]);
    if (code !== undefined) return { base, exitCode: code, output: () => output, stop: async () => {} };
    try {
      if ((await fetch(`${base}/health`)).ok) break;
    } catch {
      /* not up yet */
    }
  }
  return {
    base,
    exitCode: undefined,
    output: () => output,
    stop: async () => {
      child.kill("SIGTERM");
      await exited;
    },
  };
}

// ── MCP + OAuth helpers ──────────────────────────────────────────────────────
async function connect(base, headers = {}, authProvider) {
  const client = new Client({ name: "e2e", version: "1.0.0" }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
    requestInit: { headers },
    ...(authProvider && { authProvider }),
  });
  await client.connect(transport);
  return { client, transport };
}
const toolNames = async (client) => (await client.listTools()).tools.map((t) => t.name);
const form = (fields, headers = {}) => ({
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded", ...headers },
  body: new URLSearchParams(fields).toString(),
});
const basic = (id, secret) =>
  `Basic ${Buffer.from(`${encodeURIComponent(id)}:${encodeURIComponent(secret)}`).toString("base64")}`;

async function clientCredentialsToken(base, id, secret, extra = {}) {
  const res = await fetch(`${base}/token`, form({ grant_type: "client_credentials", ...extra }, { authorization: basic(id, secret) }));
  return { status: res.status, body: await res.json() };
}
const rawInitialize = (base, headers = {}) =>
  fetch(`${base}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "poc", version: "1.0" } },
    }),
  });
const createTag = (client, name) => client.callTool({ name: "komodo_tag_apply", arguments: { action: "create", name } });
const isToolError = async (promise) => {
  try {
    return (await promise).isError === true;
  } catch {
    return true;
  }
};

/** Browser-less run of the interactive flow: register → authorize → submit login form → token. */
async function interactiveLogin(base, formFields) {
  const redirectUri = "http://127.0.0.1:9/callback";
  const reg = await (
    await fetch(`${base}/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ redirect_uris: [redirectUri], client_name: "E2E Desktop Client", token_endpoint_auth_method: "none" }),
    })
  ).json();
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const authorize = new URL(`${base}/authorize`);
  authorize.search = new URLSearchParams({
    response_type: "code", client_id: reg.client_id, redirect_uri: redirectUri,
    code_challenge: challenge, code_challenge_method: "S256", state: "st", resource: `${base}/mcp`,
  }).toString();
  const page = await (await fetch(authorize)).text();
  const submit = await fetch(`${base}/authorize/local`, form({ ...formFields, redirect_uri: redirectUri, state: "st", code_challenge: challenge }));
  const html = await submit.text();
  if (submit.status !== 200) return { page, status: submit.status, html };
  const target = new URL(html.match(/http-equiv="refresh"\s+content="\d+;\s*url=([^"]+)"/i)[1].replace(/&amp;/g, "&"));
  const tokenRes = await fetch(`${base}/token`, form({
    grant_type: "authorization_code", code: target.searchParams.get("code"), code_verifier: verifier,
    client_id: reg.client_id, redirect_uri: redirectUri, resource: `${base}/mcp`,
  }));
  return { page, status: submit.status, tokens: await tokenRes.json(), clientId: reg.client_id };
}

/**
 * Browser-less run of a sign-in through the identity provider: register → login page → press
 * the provider button → the provider approves and sends the browser back → token.
 */
async function providerLogin(base) {
  const redirectUri = "http://127.0.0.1:9/callback";
  const reg = await (
    await fetch(`${base}/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ redirect_uris: [redirectUri], client_name: "E2E Desktop Client", token_endpoint_auth_method: "none" }),
    })
  ).json();
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const authorize = new URL(`${base}/authorize`);
  authorize.search = new URLSearchParams({
    response_type: "code", client_id: reg.client_id, redirect_uri: redirectUri,
    code_challenge: challenge, code_challenge_method: "S256", state: "st", resource: `${base}/mcp`,
  }).toString();
  const pageRes = await fetch(authorize);
  const page = await pageRes.text();
  const cookie = (pageRes.headers.getSetCookie()[0] ?? "").split(";")[0];
  const pressed = await fetch(`${base}/authorize/upstream`, {
    ...form({ redirect_uri: redirectUri, state: "st", code_challenge: challenge, provider: "oidc" }, { cookie }),
    redirect: "manual",
  });
  const onward = (await pressed.text()).match(/http-equiv="refresh"\s+content="\d+;\s*url=([^"]+)"/i)?.[1];
  if (pressed.status !== 200 || !onward) return { page, status: pressed.status, html: onward ?? "" };
  // The provider (single sign-on session) approves and redirects back to the MCP server.
  const atProvider = await fetch(onward.replace(/&amp;/g, "&"), { redirect: "manual" });
  const landed = await fetch(atProvider.headers.get("location"), { headers: { cookie } });
  const html = await landed.text();
  const back = html.match(/http-equiv="refresh"\s+content="\d+;\s*url=([^"]+)"/i)?.[1];
  if (!back) return { page, status: landed.status, html, cookie, callback: atProvider.headers.get("location") };
  const target = new URL(back.replace(/&amp;/g, "&"));
  const tokenRes = await fetch(`${base}/token`, form({
    grant_type: "authorization_code", code: target.searchParams.get("code"), code_verifier: verifier,
    client_id: reg.client_id, redirect_uri: redirectUri, resource: `${base}/mcp`,
  }));
  return { page, status: landed.status, tokens: await tokenRes.json(), clientId: reg.client_id, cookie, callback: atProvider.headers.get("location") };
}

/**
 * An MCP client that identifies itself by a web address instead of registering — as the
 * SDK's own OAuth client sees it. It keeps what the SDK hands it, and notes where the SDK
 * wants to send the browser.
 */
function urlIdentifiedClient(clientMetadataUrl, redirectUrl) {
  const kept = {};
  return {
    kept,
    clientMetadataUrl,
    get redirectUrl() {
      return redirectUrl;
    },
    get clientMetadata() {
      return {
        client_name: "E2E Desktop Client", redirect_uris: [redirectUrl], token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"], response_types: ["code"],
      };
    },
    clientInformation: () => kept.client,
    saveClientInformation: (client) => void (kept.client = client),
    tokens: () => kept.tokens,
    saveTokens: (tokens) => void (kept.tokens = tokens),
    redirectToAuthorization: (url) => void (kept.authorizationUrl = url),
    saveCodeVerifier: (verifier) => void (kept.verifier = verifier),
    codeVerifier: () => kept.verifier,
  };
}

/**
 * Stands in for the person at the browser: opens the authorization URL an MCP client was
 * given, signs in on the login page with a Komodo API key, and returns the page shown and
 * the code the client is sent back with.
 */
async function signInAt(base, authorizationUrl, user) {
  const pageRes = await fetch(authorizationUrl, { redirect: "manual" });
  const page = await pageRes.text();
  if (pageRes.status !== 200) return { status: pageRes.status, page };
  const asked = new URL(authorizationUrl).searchParams;
  const submit = await fetch(`${base}/authorize/local`, form({
    method: "api-key", username: user.key, password: user.secret,
    redirect_uri: asked.get("redirect_uri"), state: asked.get("state") ?? "", code_challenge: asked.get("code_challenge"),
  }));
  const back = (await submit.text()).match(/http-equiv="refresh"\s+content="\d+;\s*url=([^"]+)"/i)?.[1];
  return { status: submit.status, page, code: back && new URL(back.replace(/&amp;/g, "&")).searchParams.get("code") };
}

/**
 * `fetch` for a client whose token is bound to a key, as RFC 9449 has a client behave: every
 * request carries a fresh proof with the server's latest nonce, and a request the server
 * answers with `use_dpop_nonce` goes out once more with the nonce it named.
 */
const dpopFetch = (accessToken, key) => async (url, init = {}) => {
  const send = async () => {
    const headers = new Headers(init.headers);
    headers.set("authorization", `DPoP ${accessToken}`);
    headers.set("dpop", dpopProof(key, (init.method ?? "GET").toUpperCase(), String(url).split("?")[0], accessToken));
    return rememberNonce(String(url), await fetch(url, { ...init, headers }));
  };
  const first = await send();
  const askedForNonce = first.status === 401 && /error="use_dpop_nonce"/.test(first.headers.get("www-authenticate") ?? "");
  return askedForNonce ? send() : first;
};

async function connectWithFetch(base, fetchFn) {
  const client = new Client({ name: "e2e", version: "1.0.0" }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { fetch: fetchFn });
  await client.connect(transport);
  return { client, transport };
}

const serverMetadata = async (base) => (await fetch(`${base}/.well-known/oauth-authorization-server`)).json();

// ════════════════════════════════════════════════════════════════════════════
const komodo = await startFakeKomodo();
const K = USERS;

// ── 1. Default HTTP deployment: authentication on, nothing else configured ────
await group("Default HTTP deployment (auth on, only KOMODO_URL set)", async () => {
  const mcp = await startMcp({ KOMODO_URL: komodo.url });
  try {
    const anon = await rawInitialize(mcp.base);
    check("no credential → 401", anon.status === 401, `got ${anon.status}`);
    const challenge = anon.headers.get("www-authenticate") ?? "";
    check("401 names the protected-resource metadata of the MCP endpoint", /resource_metadata="[^"]+oauth-protected-resource\/mcp"/.test(challenge), challenge);
    const resourceMetadata = await (await fetch(/resource_metadata="([^"]+)"/.exec(challenge)?.[1] ?? `${mcp.base}/missing`)).json();
    check("…which names exactly the URL the client asked for (RFC 9728)", resourceMetadata.resource === `${mcp.base}/mcp`, JSON.stringify(resourceMetadata));

    const meta = await (await fetch(`${mcp.base}/.well-known/oauth-authorization-server`)).json();
    check("metadata announces client_credentials", meta.grant_types_supported.includes("client_credentials"), JSON.stringify(meta.grant_types_supported));
    check("metadata announces HTTP Basic client authentication", meta.token_endpoint_auth_methods_supported?.includes("client_secret_basic"), JSON.stringify(meta.token_endpoint_auth_methods_supported));
    check("metadata announces the three komodo scopes", ["komodo:read", "komodo:operate", "komodo:admin"].every((s) => meta.scopes_supported?.includes(s)));

    // Use case: service account / gateway, machine-to-machine, no browser.
    const admin = await clientCredentialsToken(mcp.base, K.admin.key, K.admin.secret);
    check("client_credentials with a Komodo API key → 200", admin.status === 200, JSON.stringify(admin.body));
    check("…and no refresh token is issued", admin.body.refresh_token === undefined);
    const adminSession = await connect(mcp.base, { authorization: `Bearer ${admin.body.access_token}` });
    const adminTools = await toolNames(adminSession.client);
    check("admin key sees write tools (komodo_exec, komodo_tag_apply)", adminTools.includes("komodo_exec") && adminTools.includes("komodo_tag_apply"));
    const list = await adminSession.client.callTool({ name: "komodo_server_list", arguments: {} });
    check("read tool works", list.isError !== true && JSON.stringify(list).includes("prod-1"), JSON.stringify(list).slice(0, 200));
    const created = await createTag(adminSession.client, "from-admin-key");
    check("write tool works", created.isError !== true, JSON.stringify(created).slice(0, 300));
    const afterAdmin = await komodo.state();
    check("Komodo saw the write as the key's own user", afterAdmin.writes.at(-1)?.as === "admin", JSON.stringify(afterAdmin.writes.at(-1)));
    await adminSession.transport.close();

    // A limited key gets limited tools — rights come from Komodo, not from the MCP server.
    const reader = await clientCredentialsToken(mcp.base, K.reader.key, K.reader.secret, { scope: "komodo:read komodo:operate komodo:admin" });
    check("read-only key: token is limited to komodo:read", reader.body.scope === "komodo:read", reader.body.scope);
    const readerSession = await connect(mcp.base, { authorization: `Bearer ${reader.body.access_token}` });
    const readerTools = await toolNames(readerSession.client);
    check("read-only key: write tools are hidden", !readerTools.includes("komodo_exec") && !readerTools.includes("komodo_tag_apply") && readerTools.includes("komodo_server_list"));
    check("read-only key: calling a write tool is rejected", await isToolError(createTag(readerSession.client, "from-reader")));
    check("…and nothing was written", (await komodo.state()).writes.length === afterAdmin.writes.length);

    // The limited service account of the issue: Read on deployments in general, Execute on ONE of
    // them. Tools take a resource by name; Komodo only counts a per-resource grant when asked by
    // id, and answers non-admins with a bare level instead of an object. Both used to make the
    // permission pre-check turn this account away from the very deployment it was given.
    const operator = await clientCredentialsToken(mcp.base, K.operator.key, K.operator.secret);
    check("limited service account: token carries read + operate, not admin", operator.body.scope === "komodo:read komodo:operate", JSON.stringify(operator.body));
    const operatorSession = await connect(mcp.base, { authorization: `Bearer ${operator.body.access_token}` });
    const stop = (deployment) => operatorSession.client.callTool({ name: "komodo_deployment_action", arguments: { action: "stop", deployment } });
    const writesBefore = (await komodo.state()).writes.length;
    const stopped = await stop("app").catch((error) => ({ isError: true, error: String(error) }));
    check("…it can operate the deployment it was granted, addressed by name", stopped.isError !== true, JSON.stringify(stopped).slice(0, 300));
    check("…and Komodo saw that as the service account", (await komodo.state()).writes.at(-1)?.as === "operator" && (await komodo.state()).writes.at(-1)?.target === "app");
    const info = await operatorSession.client.callTool({ name: "komodo_deployment_info", arguments: { deployment: "db" } }).catch((error) => ({ isError: true, error: String(error) }));
    check("…it can read a deployment it only has Read on", !/Insufficient Komodo permission/.test(JSON.stringify(info)), JSON.stringify(info).slice(0, 300));
    const refused = await stop("db").catch((error) => ({ isError: true, error: String(error) }));
    check("…but not operate one it has only Read on", refused.isError === true && /requires Execute, but you have Read/.test(JSON.stringify(refused)), JSON.stringify(refused).slice(0, 300));
    check("…and that attempt never reached Komodo", (await komodo.state()).writes.length === writesBefore + 1);
    await operatorSession.transport.close();

    // Keys created under Komodo 1.x look different (K-… / S-…) and must not be turned away.
    const legacy = await clientCredentialsToken(mcp.base, K.legacy.key, K.legacy.secret);
    check("a key minted by Komodo 1.x (K-… / S-…) is accepted", legacy.status === 200 && legacy.body.scope === "komodo:read", JSON.stringify(legacy.body));

    // Session ownership: the reader must not be able to use the reader's session with another identity.
    const readerSessionId = readerSession.transport.sessionId;
    const hijack = await fetch(`${mcp.base}/mcp`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "mcp-session-id": readerSessionId, authorization: `Bearer ${admin.body.access_token}` },
      body: JSON.stringify({ jsonrpc: "2.0", id: 9, method: "tools/list" }),
    });
    check("another principal's token cannot use this session → 404", hijack.status === 404, `got ${hijack.status}`);
    await readerSession.transport.close();

    const wrong = await clientCredentialsToken(mcp.base, K.admin.key, K.reader.secret);
    check("wrong secret → 401 invalid_client", wrong.status === 401 && wrong.body.error === "invalid_client", JSON.stringify(wrong));
    // A token that is no longer needed can be given back (RFC 7009) — by the key it was issued to.
    const spare = await clientCredentialsToken(mcp.base, K.reader.key, K.reader.secret);
    const revoke = (id, secret, token = spare.body.access_token) => fetch(`${mcp.base}/revoke`, form({ token }, { authorization: basic(id, secret) }));
    const usable = async () => (await rawInitialize(mcp.base, { authorization: `Bearer ${spare.body.access_token}` })).status === 200;
    const loginsBefore = (fs.existsSync(path.join(WORKDIR, "logs", "audit.log")) ? fs.readFileSync(path.join(WORKDIR, "logs", "audit.log"), "utf-8") : "").split('"action":"login"').length;
    check("a token cannot be revoked with a wrong secret", (await revoke(K.reader.key, K.admin.secret)).status === 401 && (await usable()));
    const byAnother = await revoke(K.admin.key, K.admin.secret);
    check("…or by another key, even an admin's", byAnother.status === 400 && (await byAnother.json()).error === "invalid_grant" && (await usable()), `got ${byAnother.status}`);
    const givenBack = await revoke(K.reader.key, K.reader.secret);
    check("the key it was issued to revokes it", givenBack.status === 200 && !(await usable()), `got ${givenBack.status}`);
    check("revoking a token the server does not know is not an error", (await revoke(K.reader.key, K.reader.secret, "no-such-token")).status === 200);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const trail = fs.readFileSync(path.join(WORKDIR, "logs", "audit.log"), "utf-8");
    check("a revocation is recorded as one — not as another sign-in", /"action":"client_revocation","outcome":"success"/.test(trail) && trail.split('"action":"login"').length === loginsBefore, `${trail.split('"action":"login"').length} vs ${loginsBefore}`);
    // Easy to get wrong by hand: key and secret swapped. The attempt is recorded — but the
    // secret, which arrived in the client_id field, must not be written to the audit trail.
    const swapped = await clientCredentialsToken(mcp.base, K.reader.secret, K.reader.key);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const auditLog = path.join(WORKDIR, "logs", "audit.log");
    const audit = fs.existsSync(auditLog) ? fs.readFileSync(auditLog, "utf-8") : "";
    check("key and secret swapped → 401", swapped.status === 401, JSON.stringify(swapped));
    check("…the denied attempt is audited without the secret", /"action":"client_credentials","outcome":"denied"/.test(audit) && !audit.includes(K.reader.secret));
    const disabled = await clientCredentialsToken(mcp.base, K.gone.key, K.gone.secret);
    check("key of a disabled Komodo user → 401", disabled.status === 401, JSON.stringify(disabled));
    const failuresBefore = (await komodo.state()).authFailures;
    const junk = await clientCredentialsToken(mcp.base, "admin", "admin");
    check("junk credentials → 401 without being relayed to Komodo", junk.status === 401 && (await komodo.state()).authFailures === failuresBefore);
    const foreign = await clientCredentialsToken(mcp.base, K.admin.key, K.admin.secret, { resource: "https://elsewhere.example/mcp" });
    check("token for another server's resource → invalid_target", foreign.body.error === "invalid_target", JSON.stringify(foreign.body));

    // Interoperability: the official SDK's client-credentials provider, end to end.
    const viaSdk = await connect(mcp.base, {}, new ClientCredentialsProvider({ clientId: K.admin.key, clientSecret: K.admin.secret }));
    check("official SDK ClientCredentialsProvider connects and lists tools", (await toolNames(viaSdk.client)).includes("komodo_exec"));
    await viaSdk.transport.close();

    // Header credentials are an opt-in — off here.
    const headersOff = await rawInitialize(mcp.base, { "x-api-key": K.admin.key, "x-api-secret": K.admin.secret });
    check("API-key headers are ignored unless switched on → 401", headersOff.status === 401, `got ${headersOff.status}`);

    // Interactive login (clients that only do browser OAuth): both tabs, password still works.
    const pw = await interactiveLogin(mcp.base, { method: "password", username: "admin", password: "admin-pass" });
    check("login page offers Password and API key", pw.page.includes('name="method" value="password"') && pw.page.includes('name="method" value="api-key"'));
    check("login page names the requesting client and redirect host", pw.page.includes("E2E Desktop Client") && pw.page.includes("127.0.0.1:9"));
    check("password login still works (1.5.0 behaviour)", typeof pw.tokens?.access_token === "string", JSON.stringify(pw.tokens ?? pw.status));
    check("password session gets a refresh token (Komodo JWT lives 24h)", typeof pw.tokens?.refresh_token === "string");
    const pwSession = await connect(mcp.base, { authorization: `Bearer ${pw.tokens.access_token}` });
    check("password session can write as that user", (await createTag(pwSession.client, "from-password")).isError !== true && (await komodo.state()).writes.at(-1)?.as === "admin");
    await pwSession.transport.close();

    const viaKey = await interactiveLogin(mcp.base, { method: "api-key", username: K.reader.key, password: K.reader.secret });
    check("API-key login on the login page works", viaKey.tokens?.scope === "komodo:read", JSON.stringify(viaKey.tokens ?? viaKey.status));
    const refreshed = await (await fetch(`${mcp.base}/token`, form({ grant_type: "refresh_token", refresh_token: viaKey.tokens.refresh_token, client_id: viaKey.clientId }))).json();
    check("API-key session refreshes (re-validated against Komodo)", typeof refreshed.access_token === "string" && refreshed.refresh_token !== viaKey.tokens.refresh_token, JSON.stringify(refreshed));

    // What a client holds after a server restart: a refresh token this process never issued.
    // `invalid_grant` is the answer that makes MCP clients sign in again instead of failing for good.
    const stale = await (await fetch(`${mcp.base}/token`, form({ grant_type: "refresh_token", refresh_token: "issued-before-the-restart", client_id: viaKey.clientId }))).json();
    check("a refresh token the server no longer knows → invalid_grant", stale.error === "invalid_grant", JSON.stringify(stale));

    const badPw = await interactiveLogin(mcp.base, { method: "password", username: "admin", password: "nope" });
check("wrong password → the login page again, as a refusal (403)", badPw.status === 403 && /Invalid username or password/.test(badPw.html), `got ${badPw.status}`);
    const noRegistered = await clientCredentialsToken(mcp.base, "gateway", "x".repeat(40));
    check("an unregistered client id that is not an API key → 401", noRegistered.status === 401);
  } finally {
    await mcp.stop();
  }
});

// ── 2. Registered service client acting as the [komodo] service account ───────
await group("Registered client → [komodo] service account (secret stays on the server)", async () => {
  const gatewaySecret = crypto.randomBytes(24).toString("hex"); // 48 chars
  const mcp = await startMcp({
    KOMODO_URL: komodo.url, KOMODO_API_KEY: K.svc.key, KOMODO_API_SECRET: K.svc.secret,
    MCP_AUTH_SERVICE_CLIENT_ID: "gateway", MCP_AUTH_SERVICE_CLIENT_SECRET: gatewaySecret,
  });
  try {
    const token = await clientCredentialsToken(mcp.base, "gateway", gatewaySecret);
    check("registered client gets a token", token.status === 200, JSON.stringify(token.body));
    const session = await connect(mcp.base, { authorization: `Bearer ${token.body.access_token}` });
    check("it can write", (await createTag(session.client, "from-gateway")).isError !== true);
    check("Komodo saw the write as the service account", (await komodo.state()).writes.at(-1)?.as === "mcp-service", JSON.stringify((await komodo.state()).writes.at(-1)));
    await session.transport.close();

    const wrong = await clientCredentialsToken(mcp.base, "gateway", "y".repeat(48));
    check("wrong client secret → 401", wrong.status === 401);
    check("still no access without any credential", (await rawInitialize(mcp.base)).status === 401);

    const revokeAs = (secret) => fetch(`${mcp.base}/revoke`, form({ token: token.body.access_token }, { authorization: basic("gateway", secret) }));
    check("the registered client's token cannot be revoked with a wrong secret", (await revokeAs("y".repeat(48))).status === 401 && (await rawInitialize(mcp.base, { authorization: `Bearer ${token.body.access_token}` })).status === 200);
    check("the registered client revokes its own token", (await revokeAs(gatewaySecret)).status === 200 && (await rawInitialize(mcp.base, { authorization: `Bearer ${token.body.access_token}` })).status === 401);

    // An API key keeps acting as its own user even though a service account is configured.
    const reader = await clientCredentialsToken(mcp.base, K.reader.key, K.reader.secret);
    const readerSession = await connect(mcp.base, { authorization: `Bearer ${reader.body.access_token}` });
    check("a user's API key does not inherit the service account's rights", !(await toolNames(readerSession.client)).includes("komodo_exec"));
    await readerSession.transport.close();
  } finally {
    await mcp.stop();
  }

  const capped = await startMcp({
    KOMODO_URL: komodo.url, KOMODO_API_KEY: K.svc.key, KOMODO_API_SECRET: K.svc.secret,
    MCP_AUTH_SERVICE_CLIENT_ID: "gateway", MCP_AUTH_SERVICE_CLIENT_SECRET: gatewaySecret, MCP_AUTH_SERVICE_CLIENT_SCOPES: "komodo:read",
  });
  try {
    const token = await clientCredentialsToken(capped.base, "gateway", gatewaySecret);
    check("scope cap: token carries only komodo:read", token.body.scope === "komodo:read", token.body.scope);
    const session = await connect(capped.base, { authorization: `Bearer ${token.body.access_token}` });
    check("scope cap: write tools hidden although the service account is admin", !(await toolNames(session.client)).includes("komodo_tag_apply"));
    await session.transport.close();
  } finally {
    await capped.stop();
  }

  const noAccount = await startMcp({ KOMODO_URL: komodo.url, MCP_AUTH_SERVICE_CLIENT_ID: "gateway", MCP_AUTH_SERVICE_CLIENT_SECRET: gatewaySecret });
  try {
    check("registered client without [komodo] credentials is disabled at start-up", /clients are disabled/.test(noAccount.output()), noAccount.output().slice(-400));
    check("…and cannot get a token", (await clientCredentialsToken(noAccount.base, "gateway", gatewaySecret)).status === 401);
  } finally {
    await noAccount.stop();
  }

  const weak = await startMcp({ KOMODO_URL: komodo.url, KOMODO_API_KEY: K.svc.key, KOMODO_API_SECRET: K.svc.secret, MCP_AUTH_SERVICE_CLIENT_ID: "gateway", MCP_AUTH_SERVICE_CLIENT_SECRET: "hunter2" });
  try {
    check("a short client secret is refused: no token", (await clientCredentialsToken(weak.base, "gateway", "hunter2")).status === 401);
  } finally {
    await weak.stop();
  }
});

// ── 3. API-key headers (opt-in) ───────────────────────────────────────────────
await group("API-key headers (MCP_AUTH_API_KEY_HEADER=true) — clients that only send static headers", async () => {
  const mcp = await startMcp({ KOMODO_URL: komodo.url, MCP_AUTH_API_KEY_HEADER: "true" });
  try {
    check("start-up warns that header authentication is on", /API-key header authentication is enabled/.test(mcp.output()));
    const session = await connect(mcp.base, { "x-api-key": K.admin.key, "x-api-secret": K.admin.secret });
    check("valid headers connect without any login", (await toolNames(session.client)).includes("komodo_exec"));
    check("writes act as the key's user", (await createTag(session.client, "from-headers")).isError !== true && (await komodo.state()).writes.at(-1)?.as === "admin");
    await session.transport.close();

    const reader = await connect(mcp.base, { "x-api-key": K.reader.key, "x-api-secret": K.reader.secret });
    check("a read-only key via headers sees no write tools", !(await toolNames(reader.client)).includes("komodo_exec"));
    await reader.transport.close();

    check("wrong secret → 401", (await rawInitialize(mcp.base, { "x-api-key": K.admin.key, "x-api-secret": K.reader.secret })).status === 401);
    check("key without secret → 401", (await rawInitialize(mcp.base, { "x-api-key": K.admin.key })).status === 401);
    check("no credential at all → still 401", (await rawInitialize(mcp.base)).status === 401);

    // A client that only ever sends valid headers must never be slowed down by the limit on
    // rejected credentials — not by many requests, and not by event streams it opens and drops
    // (what every MCP client does when it disconnects or reconnects).
    const valid = { "x-api-key": K.admin.key, "x-api-secret": K.admin.secret };
    const statuses = new Set();
    for (let i = 0; i < 30; i++) {
      const init = await rawInitialize(mcp.base, valid);
      statuses.add(init.status);
      await init.text();
      const dropped = new AbortController();
      await fetch(`${mcp.base}/mcp`, { headers: { accept: "text/event-stream", "mcp-session-id": init.headers.get("mcp-session-id"), ...valid }, signal: dropped.signal }).catch(() => {});
      dropped.abort();
    }
    check("30 connects with dropped event streams, valid headers only → never limited", statuses.size === 1 && statuses.has(200), [...statuses].join(","));

    // A client that keeps sending one outdated secret is refused, but it is not guessing: it
    // must not lock out everyone else behind the same address.
    const stale = new Set();
    for (let i = 0; i < 25; i++) stale.add((await rawInitialize(mcp.base, { "x-api-key": K.admin.key, "x-api-secret": K.reader.secret })).status);
    check("the same wrong secret 25 times → 401 each time, no lockout", stale.size === 1 && stale.has(401), [...stale].join(","));

    // Guessing is trying many different credentials: 20 of them within 15 minutes lock the address out.
    let rejected = 0;
    let lockout;
    for (let i = 0; i < 25 && !lockout; i++) {
      const res = await rawInitialize(mcp.base, { "x-api-key": K.admin.key, "x-api-secret": `S-guess-${i}` });
      if (res.status === 401) rejected++;
      else lockout = res;
    }
    check("different wrong secrets → 429 with Retry-After once 20 were tried", lockout?.status === 429 && Number(lockout.headers.get("retry-after")) > 0 && rejected <= 20, `rejected=${rejected} then ${lockout?.status}`);
    check("…a key that worked before is still served during the lockout", (await rawInitialize(mcp.base, valid)).status === 200);
    check("…a valid key the server has not seen yet waits until the lockout ends", (await rawInitialize(mcp.base, { "x-api-key": K.operator.key, "x-api-secret": K.operator.secret })).status === 429);
  } finally {
    await mcp.stop();
  }
});

// ── 4. Komodo without username/password login (SSO-only instance) ─────────────
await group("Komodo with local login disabled (SSO-only)", async () => {
  const ssoKomodo = await startFakeKomodo({ localAuth: false });
  // What such an operator tries first: declare the identity provider for the MCP server too.
  const withProvider = path.join(WORKDIR, "sso.config.toml");
  fs.writeFileSync(withProvider, '[auth.providers.authentik]\ntype = "oidc"\nissuer = "https://sso.example.com/application/o/komodo/"\nid = "komodo"\nsecret = "not-a-real-secret"\n');
  const mcp = await startMcp({ KOMODO_URL: ssoKomodo.url, MCP_CONFIG_FILE_PATH: withProvider });
  try {
    const login = await interactiveLogin(mcp.base, { method: "api-key", username: K.admin.key, password: K.admin.secret });
    check("a declared identity provider is reported at start-up as not offered — with the reason and the way that works", /Sign-in through oidc: https:\/\/sso\.example\.com\S* is configured but cannot be offered: this Komodo Core has no token exchange/.test(mcp.output()) && /Komodo API key/.test(mcp.output()), mcp.output().slice(-600));
    check("…and the login page offers no button for it", !login.page.includes("/authorize/upstream"));
    check("login page offers the API key form only", login.page.includes('name="method" value="api-key"') && !login.page.includes('name="method" value="password"'));
    check("signing in with an API key works", typeof login.tokens?.access_token === "string", JSON.stringify(login.tokens ?? login.status));
    check("client_credentials works too", (await clientCredentialsToken(mcp.base, K.admin.key, K.admin.secret)).status === 200);
  } finally {
    await mcp.stop();
    await ssoKomodo.close();
  }
});

// ── 4b. Sign-in through the identity provider ─────────────────────────────────
await group("Sign-in through an identity provider (Komodo exchanges the ID token, RFC 8693)", async () => {
  const oidcClient = { id: "komodo-mcp", secret: "the-mcp-servers-secret-at-the-provider" };
  const idp = await startFakeOidc(oidcClient);
  // A Komodo that signs people in through that provider only, and trusts tokens it issues to the MCP server.
  const ssoKomodo = await startFakeKomodo({ localAuth: false, tokenExchange: { issuer: idp.issuer, jwk: idp.jwk, audiences: ["komodo", oidcClient.id] } });
  const mcp = await startMcp({
    KOMODO_URL: ssoKomodo.url,
    MCP_AUTH_OIDC_ISSUER: idp.issuer,
    MCP_AUTH_OIDC_CLIENT_ID: oidcClient.id,
    MCP_AUTH_OIDC_CLIENT_SECRET: oidcClient.secret,
    MCP_AUTH_OIDC_NAME: "Example SSO",
  });
  try {
    check("the server starts and offers the provider", mcp.exitCode === undefined && !/cannot be offered/.test(mcp.output()) && /sign-in: oidc: /.test(mcp.output()), mcp.output().slice(-500));

    idp.signIn("carol-sub");
    const carol = await providerLogin(mcp.base);
    check("the login page offers the provider next to the API key form — and no password form", carol.page.includes("Continue with Example SSO") && carol.page.includes('name="method" value="api-key"') && !carol.page.includes('name="method" value="password"'));
    check("carol signs in through the provider and gets the MCP server's own tokens", typeof carol.tokens?.access_token === "string" && typeof carol.tokens?.refresh_token === "string", JSON.stringify({ status: carol.status, error: carol.tokens?.error }));
    check("…none of which is the provider's", !JSON.stringify(carol.tokens).includes("idp-access-token") && carol.tokens.id_token === undefined);
    check("her scopes are what Komodo allows her: read and operate, not admin", carol.tokens.scope === "komodo:read komodo:operate", carol.tokens.scope);
    const exchanged = (await ssoKomodo.state()).exchanges.at(-1);
    check("Komodo exchanged a token issued to the MCP server's own client id", exchanged?.as === "carol" && exchanged?.audience === oidcClient.id, JSON.stringify(exchanged));

    const session = await connect(mcp.base, { authorization: `Bearer ${carol.tokens.access_token}` });
    const tools = await toolNames(session.client);
    check("her tools follow her Komodo permissions", tools.includes("komodo_deployment_action") && !tools.includes("komodo_tag_apply"), `${tools.length} tools`);
    const stopped = await session.client.callTool({ name: "komodo_deployment_action", arguments: { action: "stop", deployment: "app" } });
    check("she operates the deployment she was granted", stopped.isError !== true, JSON.stringify(stopped).slice(0, 300));
    check("…and Komodo saw it as carol herself", (await ssoKomodo.state()).writes.at(-1)?.as === "carol", JSON.stringify((await ssoKomodo.state()).writes.at(-1)));
    check("…but not the one she was not", await isToolError(session.client.callTool({ name: "komodo_deployment_action", arguments: { action: "stop", deployment: "db" } })));
    await session.transport.close();

    const refreshed = await fetch(`${mcp.base}/token`, form({ grant_type: "refresh_token", refresh_token: carol.tokens.refresh_token, client_id: carol.clientId, resource: `${mcp.base}/mcp` }));
    check("her session is renewed against Komodo, without the provider", refreshed.status === 200 && (await refreshed.json()).scope === "komodo:read komodo:operate", String(refreshed.status));

    check("a token of the provider itself is not accepted at the MCP server", (await rawInitialize(mcp.base, { authorization: "Bearer idp-access-token-of-carol-sub" })).status === 401);
    check("the provider's ID token is not accepted as a bearer token either", (await rawInitialize(mcp.base, { authorization: `Bearer ${idp.idToken("carol-sub")}` })).status === 401);

    const replay = await fetch(carol.callback, { headers: { cookie: carol.cookie } });
    check("the provider's answer cannot be replayed", replay.status === 400, String(replay.status));

    idp.signIn("dave-sub");
    const dave = await providerLogin(mcp.base);
    check("someone the provider knows but Komodo does not is turned away, with the way forward", dave.tokens === undefined && dave.status === 403 && /may not be linked to this provider yet/.test(dave.html) && /Komodo API key/.test(dave.html), `${dave.status} ${dave.html?.slice(0, 200)}`);
    check("…and Komodo's own wording stays in the log", !/No user is linked/.test(dave.html) && /No user is linked/.test(mcp.output()));

    idp.signIn("erin-sub");
    const erin = await providerLogin(mcp.base);
    check("an account that needs a second factor is pointed to an API key", erin.tokens === undefined && /second factor/.test(erin.html) && /API key/.test(erin.html), erin.html?.slice(0, 200));

    idp.signIn("frank-sub");
    const frank = await providerLogin(mcp.base);
    check("a disabled Komodo account is told so", frank.tokens === undefined && /not enabled/.test(frank.html), frank.html?.slice(0, 200));

    const viaKey = await interactiveLogin(mcp.base, { method: "api-key", username: K.carol.key, password: K.carol.secret });
    check("the API key keeps working next to the provider", typeof viaKey.tokens?.access_token === "string" && viaKey.tokens.scope === "komodo:read komodo:operate", JSON.stringify(viaKey.tokens?.scope ?? viaKey.status));
    check("no ID token was written to the log", !/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\./.test(mcp.output()));
    check("…nor the client secret the server holds at the provider", !mcp.output().includes(oidcClient.secret));

    // ── nothing of it in the log, however verbose ───────────────────────────
    // A provider sign-in handles more secrets than any other way in: the server's client
    // secret at the provider, the provider's code and tokens, the ID token, the Komodo session.
    const verbose = await startMcp({
      KOMODO_URL: ssoKomodo.url,
      MCP_AUTH_OIDC_ISSUER: idp.issuer,
      MCP_AUTH_OIDC_CLIENT_ID: oidcClient.id,
      MCP_AUTH_OIDC_CLIENT_SECRET: oidcClient.secret,
      LOG_LEVEL: "trace",
      LOG_AUDIT_TOOL_IO: "full",
    });
    try {
      idp.signIn("carol-sub");
      const traced = await providerLogin(verbose.base);
      const session = await connect(verbose.base, { authorization: `Bearer ${traced.tokens.access_token}` });
      await toolNames(session.client);
      await session.transport.close();
      idp.signIn("dave-sub");
      const refused = await providerLogin(verbose.base);

      await new Promise((resolve) => setTimeout(resolve, 300));
      const auditLog = path.join(WORKDIR, "logs", "audit.log");
      const written = verbose.output() + (fs.existsSync(auditLog) ? fs.readFileSync(auditLog, "utf-8") : "");
      const secrets = {
        "the client secret at the provider": oidcClient.secret,
        "the provider's access token": "idp-access-token-of-",
        "the provider's authorization code": new URL(traced.callback).searchParams.get("code"),
        "the state sent to the provider": new URL(traced.callback).searchParams.get("state"),
        "the browser-binding cookie": traced.cookie.split("=")[1],
        "the MCP access token": traced.tokens.access_token,
        "the MCP refresh token": traced.tokens.refresh_token,
        "the code of the refused sign-in": new URL(refused.callback).searchParams.get("code"),
      };
      const leaked = Object.entries(secrets).filter(([, value]) => value && written.includes(value)).map(([name]) => name);
      check("at the most verbose log level a provider sign-in is traced…", verbose.output().length > 2000 && /Sign-in via oidc/.test(verbose.output()) && /"method":"sso"/.test(written), verbose.output().slice(-300));
      check("…without a secret, code or token in anything the server wrote", leaked.length === 0, leaked.join(", "));
      check("…and without an ID token or Komodo session token", !/eyJ[\w-]{8,}\.eyJ[\w-]{8,}\./.test(written));
    } finally {
      await verbose.stop();
    }

    // ── the same in a real browser ──────────────────────────────────────────
    // Only a browser enforces the login page's Content-Security-Policy and its cookie rules;
    // a sign-in that works over plain HTTP requests can still be dead in the browser.
    if (!browserPath()) {
      console.log("  ·     no Chrome-family browser on this machine — browser checks skipped (set CHROME_PATH)");
    } else {
      const browser = await launchBrowser();
      try {
        const redirectUri = "http://127.0.0.1:9/callback";
        const open = async () => {
          const reg = await (await fetch(`${mcp.base}/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ redirect_uris: [redirectUri], client_name: "E2E Browser", token_endpoint_auth_method: "none" }) })).json();
          const challenge = crypto.createHash("sha256").update(crypto.randomBytes(32).toString("base64url")).digest("base64url");
          const tab = await browser.newPage();
          await tab.goto(`${mcp.base}/authorize?${new URLSearchParams({ response_type: "code", client_id: reg.client_id, redirect_uri: redirectUri, code_challenge: challenge, code_challenge_method: "S256", state: "st", resource: `${mcp.base}/mcp` })}`);
          await tab.waitFor(() => tab.has('form[action="/authorize/upstream"] button'));
          return tab;
        };
        const arrived = (tab) => tab.waitFor(() => tab.requests.find((url) => url.startsWith(redirectUri)), 15_000);
        const refusals = (tab) => tab.blocked.filter((entry) => !/favicon|127\.0\.0\.1:9/.test(entry));

        idp.signIn("carol-sub");
        const viaProvider = await open();
        await viaProvider.click('form[action="/authorize/upstream"] button');
        const back = await arrived(viaProvider);
        check("in a browser: pressing the provider button leads through to the client, code in hand", Boolean(back) && new URL(back).searchParams.has("code") && new URL(back).searchParams.get("state") === "st", back ? "no code" : `stuck at ${(await viaProvider.url()).slice(0, 90)} — ${refusals(viaProvider).join(" | ").slice(0, 300)}`);
        check("…and the browser had nothing to object to (Content-Security-Policy, cookies)", refusals(viaProvider).length === 0, refusals(viaProvider).join(" | ").slice(0, 400));

        const viaKey = await open();
        await viaKey.click('label[for="login-method-0"]');
        await viaKey.fill('.method-panel-0 input[name="username"], input[name="username"]', K.carol.key);
        await viaKey.fill('.method-panel-0 input[name="password"], input[name="password"]', K.carol.secret);
        await viaKey.click('form[action="/authorize/local"] button[type="submit"]');
        const backWithKey = await arrived(viaKey);
        check("in a browser: the API key form leads through as well", Boolean(backWithKey) && new URL(backWithKey).searchParams.has("code"), backWithKey ? "no code" : `stuck at ${(await viaKey.url()).slice(0, 90)} — ${(await viaKey.text()).replace(/\s+/g, " ").slice(0, 200)}`);
      } finally {
        await browser.close();
      }
    }
  } finally {
    await mcp.stop();
    await ssoKomodo.close();
    await idp.close();
  }
});

// ── A refused client is told how to authenticate ─────────────────────────────
await group("A client that cannot be authenticated gets 401 with a way to authenticate (RFC 9110)", async () => {
  const mcp = await startMcp({ KOMODO_URL: komodo.url });
  try {
    // HTTP requires every 401 to say how one can authenticate — whichever way the client tried.
    const BASIC = 'Basic realm="token", charset="UTF-8"';
    const viaBasic = await fetch(`${mcp.base}/token`, form({ grant_type: "client_credentials" }, { authorization: basic(K.admin.key, K.reader.secret) }));
    const viaBody = await fetch(`${mcp.base}/token`, form({ grant_type: "client_credentials", client_id: K.admin.key, client_secret: K.reader.secret }));
    const viaBodyRevoke = await fetch(`${mcp.base}/revoke`, form({ token: "t", client_id: K.admin.key, client_secret: K.reader.secret }));
    check("a refused client is told how to authenticate — secret sent with HTTP Basic", viaBasic.status === 401 && viaBasic.headers.get("www-authenticate") === BASIC, viaBasic.headers.get("www-authenticate") ?? "none");
    check("…and just the same with the secret in the request body", viaBody.status === 401 && viaBody.headers.get("www-authenticate") === BASIC, `${viaBody.status} ${viaBody.headers.get("www-authenticate") ?? "none"}`);
    check("…also when it asks for a revocation", viaBodyRevoke.status === 401 && viaBodyRevoke.headers.get("www-authenticate") === BASIC, `${viaBodyRevoke.status} ${viaBodyRevoke.headers.get("www-authenticate") ?? "none"}`);
    const otherRefusal = await fetch(`${mcp.base}/token`, form({ grant_type: "client_credentials", resource: "https://other.example/mcp" }, { authorization: basic(K.admin.key, K.admin.secret) }));
    check("a refusal for another reason is a 400 without such a hint", otherRefusal.status === 400 && otherRefusal.headers.get("www-authenticate") === null, `${otherRefusal.status} ${otherRefusal.headers.get("www-authenticate")}`);

  } finally {
    await mcp.stop();
  }
});

// ── Applications that identify themselves by a web address ───────────────────
await group("MCP clients that identify themselves by a web address (client metadata documents)", async () => {
  const certificate = loopbackCertificate(WORKDIR);
  if (!certificate) {
    console.log("  SKIP  no openssl on this machine — cannot publish a metadata document over TLS");
    return;
  }
  const redirectUri = "http://127.0.0.1/callback";
  const document = (origin, name, overrides = {}) => ({
    client_id: `${origin}/${name}`, client_name: "Acme Desktop", client_uri: origin,
    redirect_uris: [redirectUri], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"],
    token_endpoint_auth_method: "none", ...overrides,
  });
  const clientKey = newKey();
  // What Acme's website publishes: its app, a second app that authenticates with a key, and
  // a few things that are not acceptable documents.
  const site = await startSite(certificate, {
    "/app.json": (origin) => document(origin, "app.json"),
    "/keyed.json": (origin) => document(origin, "keyed.json", { client_name: "Acme Backend", token_endpoint_auth_method: "private_key_jwt", jwks: { keys: [clientKey.publicJwk] } }),
    "/other-name.json": (origin) => document(origin, "app.json"),
    "/with-secret.json": (origin) => document(origin, "with-secret.json", { client_secret: "s3cret" }),
    "/moved.json": (origin) => ({ status: 302, headers: { location: `${origin}/app.json` }, body: "" }),
    "/page.json": () => ({ status: 200, headers: { "content-type": "text/html" }, body: "<html></html>" }),
    "/huge.json": (origin) => document(origin, "huge.json", { padding: "x".repeat(8000) }),
  });
  // The server runs on this machine in this check, so — as a development set-up — it may
  // fetch documents from this machine, and is told to trust the site's certificate.
  const trust = { NODE_EXTRA_CA_CERTS: certificate.certPath };
  const mcp = await startMcp({ KOMODO_URL: komodo.url, ...trust });
  try {
    const meta = await serverMetadata(mcp.base);
    check("the server announces that it accepts such clients", meta.client_id_metadata_document_supported === true);
    check("…and says at start-up that this needs outbound HTTPS, and how to switch it off", /introduce themselves by web address: on, from any website \(needs outbound HTTPS; MCP_AUTH_CLIENT_METADATA=false turns it off\)/.test(mcp.output()), mcp.output().slice(-400));

    // The SDK's own OAuth client: it discovers the server and decides by itself how to introduce the client.
    const appUrl = `${site.origin}/app.json`;
    const app = urlIdentifiedClient(appUrl, "http://127.0.0.1:49152/callback");
    const first = await auth(app, { serverUrl: `${mcp.base}/mcp` });
    const asked = new URL(app.kept.authorizationUrl);
    check("an SDK client presents its web address instead of registering", first === "REDIRECT" && asked.searchParams.get("client_id") === appUrl && app.kept.client?.client_id === appUrl, `${first} ${asked.searchParams.get("client_id")}`);

    const signedIn = await signInAt(mcp.base, asked, K.reader);
    check("the login page names the application as its website describes it", signedIn.page.includes("Acme Desktop"), signedIn.page.slice(0, 200));
    check("…says which website vouches for that name", /identified by <code>127\.0\.0\.1:\d+<\/code>/.test(signedIn.page));
    check("…and warns that an application on this device cannot be verified", signedIn.page.includes('class="client-warning"') && signedIn.page.includes("Continue only if you started this sign-in yourself"));
    check("the sign-in returns to the port the client listens on (any loopback port)", signedIn.status === 200 && Boolean(signedIn.code), `status ${signedIn.status}`);

    const second = await auth(app, { serverUrl: `${mcp.base}/mcp`, authorizationCode: signedIn.code });
    check("the SDK client gets its tokens", second === "AUTHORIZED" && Boolean(app.kept.tokens?.access_token) && Boolean(app.kept.tokens?.refresh_token), second);
    const session = await connect(mcp.base, { authorization: `Bearer ${app.kept.tokens.access_token}` });
    const tools = await toolNames(session.client);
    check("…and works with the Komodo permissions of the person who signed in", tools.includes("komodo_server_list") && !tools.includes("komodo_tag_apply"), tools.join(","));
    await session.transport.close();
    check("the document was fetched once for all of that", site.requests.filter((r) => r === "/app.json").length === 1, site.requests.join(" "));

    // What must not pass for a client.
    const refused = async (name, redirect = redirectUri) => {
      const url = new URL(`${mcp.base}/authorize`);
      url.search = new URLSearchParams({ response_type: "code", client_id: `${site.origin}/${name}`, redirect_uri: redirect, code_challenge: "c".repeat(43), code_challenge_method: "S256", state: "st" }).toString();
      const res = await fetch(url, { redirect: "manual" });
      const text = await res.text();
      let body = {};
      try { body = JSON.parse(text); } catch { /* an answer in words */ }
      return { status: res.status, text, body };
    };
    for (const [name, why] of [
      ["missing.json", "nothing is published there"],
      ["other-name.json", "the document names another address than it was fetched from"],
      ["with-secret.json", "the document contains a client secret"],
      ["moved.json", "the address redirects elsewhere"],
      ["page.json", "what is served is not JSON"],
      ["huge.json", "the document is larger than 5 kB"],
    ]) {
      const res = await refused(name);
      check(`no client when ${why}`, res.status === 400 && /could not confirm it/.test(res.text) && !/<html|error_description/.test(res.text), JSON.stringify(res));
    }
    check("the person at the browser is told so in words, and where the reason is to be found", /identifies itself by its web address/.test((await refused("missing.json")).text) && /server's log/.test((await refused("missing.json")).text));
    check("…and the log has the reason for each", /app\.json|missing\.json/.test(mcp.output()) && /missing\.json not accepted: answered with HTTP 404/.test(mcp.output()) && /with-secret\.json not accepted: it contains a client secret/.test(mcp.output()), mcp.output().slice(-600));
    check("the redirect was not followed", !site.requests.slice(site.requests.indexOf("/moved.json") + 1).includes("/app.json") || site.requests.filter((r) => r === "/app.json").length === 1, site.requests.join(" "));
    const elsewhere = await refused("app.json", "https://evil.example/steal");
    check("a sign-in is only sent back to an address the document lists", elsewhere.status === 400 && elsewhere.body.error === "invalid_request", JSON.stringify(elsewhere));

    // A client that publishes a key is held to it.
    const keyedUrl = `${site.origin}/keyed.json`;
    const verifier = crypto.randomBytes(32).toString("base64url");
    const authorize = new URL(`${mcp.base}/authorize`);
    authorize.search = new URLSearchParams({ response_type: "code", client_id: keyedUrl, redirect_uri: redirectUri, code_challenge: crypto.createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", state: "st", resource: `${mcp.base}/mcp` }).toString();
    const keyedSignIn = await signInAt(mcp.base, authorize, K.reader);
    const grant = { grant_type: "authorization_code", code: keyedSignIn.code, code_verifier: verifier, redirect_uri: redirectUri, resource: `${mcp.base}/mcp` };
    const withoutKey = await fetch(`${mcp.base}/token`, form({ ...grant, client_id: keyedUrl }));
    check("a client that publishes a key gets no tokens by naming itself", withoutKey.status === 401 && (await withoutKey.json()).error === "invalid_client", `got ${withoutKey.status}`);
    const assertion = { client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer", client_assertion: clientAssertion(clientKey, keyedUrl, meta.issuer) };
    const withKey = await fetch(`${mcp.base}/token`, form({ ...grant, ...assertion }));
    const keyedTokens = await withKey.json();
    check("…and gets them with an assertion signed by that key", withKey.status === 200 && Boolean(keyedTokens.access_token), JSON.stringify(keyedTokens).slice(0, 200));
    const ownToken = await fetch(`${mcp.base}/token`, form({ grant_type: "client_credentials", client_assertion_type: assertion.client_assertion_type, client_assertion: clientAssertion(clientKey, keyedUrl, meta.issuer) }));
    check("proving which application it is does not give it a Komodo identity of its own", ownToken.status === 400 && (await ownToken.json()).error === "unauthorized_client", `got ${ownToken.status}`);
    check("no credential still means no access", (await rawInitialize(mcp.base)).status === 401);

    // ── the same login page in a real browser ───────────────────────────────
    // Whether a person actually gets to see the notice — and can still sign in — is decided
    // by the browser: its layout, the page's Content-Security-Policy, its form handling.
    if (!browserPath()) {
      console.log("  ·     no Chrome-family browser on this machine — browser checks skipped (set CHROME_PATH)");
    } else {
      const browser = await launchBrowser();
      try {
        const returnTo = "http://127.0.0.1:49152/callback";
        const challenge = crypto.createHash("sha256").update(crypto.randomBytes(32).toString("base64url")).digest("base64url");
        const tab = await browser.newPage();
        await tab.goto(`${mcp.base}/authorize?${new URLSearchParams({ response_type: "code", client_id: appUrl, redirect_uri: returnTo, code_challenge: challenge, code_challenge_method: "S256", state: "st", resource: `${mcp.base}/mcp` })}`);
        await tab.waitFor(() => tab.has('form[action="/authorize/local"] button[type="submit"]'));
        const shown = await tab.evaluate(`(() => {
          const visible = (el) => { if (!el) return false; const box = el.getBoundingClientRect(); const style = getComputedStyle(el);
            return box.width > 0 && box.height > 0 && style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0; };
          const notice = document.querySelector(".client-notice"); const warning = document.querySelector(".client-warning");
          return { notice: visible(notice) ? notice.innerText : "", warning: visible(warning) ? warning.innerText : "",
            warningBackground: warning ? getComputedStyle(warning).backgroundColor : "" };
        })()`);
        check("in a browser: the page names the application and the website that vouches for it", /Acme Desktop/.test(shown.notice) && /identified by 127\.0\.0\.1:\d+/.test(shown.notice), JSON.stringify(shown.notice));
        check("in a browser: the warning about an application on this device is visible", /cannot be\s+verified/.test(shown.warning) && !/rgba\(0, 0, 0, 0\)|transparent/.test(shown.warningBackground), JSON.stringify(shown));
        await tab.click('label[for="login-method-0"]');
        await tab.fill('.method-panel-0 input[name="username"]', "reader");
        await tab.fill('.method-panel-0 input[name="password"]', "reader-pass");
        await tab.click('.method-panel-0 form[action="/authorize/local"] button[type="submit"]');
        const back = await tab.waitFor(() => tab.requests.find((url) => url.startsWith(returnTo)), 15_000);
        const refusals = tab.blocked.filter((entry) => !/favicon|127\.0\.0\.1:49152/.test(entry));
        check("in a browser: signing in leads back to the application, code in hand", Boolean(back) && new URL(back).searchParams.has("code"), back ? "no code" : `stuck at ${(await tab.url()).slice(0, 90)} — ${(await tab.text()).replace(/\s+/g, " ").slice(0, 200)}`);
        check("…and the browser had nothing to object to", refusals.length === 0, refusals.join(" | ").slice(0, 300));
      } finally {
        await browser.close();
      }
    }
  } finally {
    await mcp.stop();
  }

  // Restricted to named websites.
  const restricted = await startMcp({ KOMODO_URL: komodo.url, ...trust, MCP_AUTH_CLIENT_METADATA_HOSTS: "claude.ai,*.vscode.dev" });
  try {
    const before = site.requests.length;
    const outsider = urlIdentifiedClient(`${site.origin}/app.json`, "http://127.0.0.1:49152/callback");
    await auth(outsider, { serverUrl: `${restricted.base}/mcp` });
    const res = await fetch(outsider.kept.authorizationUrl, { redirect: "manual" });
check("with a list of accepted websites, a client from another one is refused", res.status === 400 && /could not confirm it/.test(await res.text()), `got ${res.status}`);
    check("…without its website even being contacted", site.requests.length === before, site.requests.slice(before).join(" "));
  } finally {
    await restricted.stop();
  }

  // Switched off: clients register as before.
  const off = await startMcp({ KOMODO_URL: komodo.url, ...trust, MCP_AUTH_CLIENT_METADATA: "false" });
  try {
check("switched off, the server no longer announces it", !("client_id_metadata_document_supported" in (await serverMetadata(off.base))) && /introduce themselves by web address: off \(clients register\)/.test(off.output()));
    const fallback = urlIdentifiedClient(`${site.origin}/app.json`, "http://127.0.0.1:49152/callback");
    const started = await auth(fallback, { serverUrl: `${off.base}/mcp` });
    const clientId = new URL(fallback.kept.authorizationUrl).searchParams.get("client_id");
    check("…and the same SDK client registers instead", started === "REDIRECT" && !clientId.startsWith("https://") && fallback.kept.client?.client_id === clientId, clientId);
    const signedIn = await signInAt(off.base, fallback.kept.authorizationUrl, K.reader);
    check("…and signs in the way it did before", (await auth(fallback, { serverUrl: `${off.base}/mcp`, authorizationCode: signedIn.code })) === "AUTHORIZED");
    const url = new URL(`${off.base}/authorize`);
    url.search = new URLSearchParams({ response_type: "code", client_id: `${site.origin}/app.json`, redirect_uri: redirectUri, code_challenge: "c".repeat(43), code_challenge_method: "S256" }).toString();
    // An application that remembered its web address from before the switch keeps presenting it.
    const remembered = urlIdentifiedClient(`${site.origin}/app.json`, "http://127.0.0.1:49152/callback");
    remembered.kept.client = { client_id: `${site.origin}/app.json` };
    const before = site.requests.length;
    const again = await auth(remembered, { serverUrl: `${off.base}/mcp` });
    const stale = await signInAt(off.base, remembered.kept.authorizationUrl, K.reader);
    check("an application that remembered its web address from before can still sign in", again === "REDIRECT" && stale.status === 200 && (await auth(remembered, { serverUrl: `${off.base}/mcp`, authorizationCode: stale.code })) === "AUTHORIZED", `${again} ${stale.status}`);
    check("…as an application nothing vouches for: no name, no website, nothing looked up", stale.page.includes("an MCP client") && !stale.page.includes("identified by") && !stale.page.includes("Acme Desktop") && site.requests.length === before, stale.page.match(/client-notice">[\s\S]{0,160}/)?.[0] ?? "");
    void url;
  } finally {
    await off.stop();
    await site.close();
  }
});

// ── Machine clients that authenticate with a key ─────────────────────────────
await group("Registered client with a key instead of a secret (private_key_jwt)", async () => {
  const key = newKey();
  const keyFile = path.join(WORKDIR, "gateway.pub.pem");
  fs.writeFileSync(keyFile, key.publicPem);
  const serviceAccount = { KOMODO_URL: komodo.url, KOMODO_API_KEY: K.svc.key, KOMODO_API_SECRET: K.svc.secret };
  const mcp = await startMcp({ ...serviceAccount, MCP_AUTH_SERVICE_CLIENT_ID: "gateway", MCP_AUTH_SERVICE_CLIENT_PUBLIC_KEY_FILE: keyFile });
  try {
    const meta = await serverMetadata(mcp.base);
    check("the server announces private_key_jwt and the algorithms it accepts", meta.token_endpoint_auth_methods_supported.includes("private_key_jwt") && meta.token_endpoint_auth_signing_alg_values_supported.includes("ES256") && !meta.token_endpoint_auth_signing_alg_values_supported.includes("HS256"), JSON.stringify(meta.token_endpoint_auth_methods_supported));

    // The SDK's own client for this: it signs the assertion itself.
    const session = await connect(mcp.base, {}, new PrivateKeyJwtProvider({ clientId: "gateway", privateKey: key.privatePem, algorithm: "ES256" }));
    check("an SDK client connects with nothing but its private key", (await toolNames(session.client)).includes("komodo_tag_apply"));
    check("…and acts as the [komodo] service account", (await createTag(session.client, "from-keyed-gateway")).isError !== true && (await komodo.state()).writes.at(-1)?.as === "mcp-service");
    await session.transport.close();

    const request = (assertion) => fetch(`${mcp.base}/token`, form({ grant_type: "client_credentials", client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer", client_assertion: assertion }));
    const once = clientAssertion(key, "gateway", meta.issuer);
    check("a signed assertion → 200", (await request(once)).status === 200);
    check("the same assertion a second time → 401", (await request(once)).status === 401);
const foreign = await request(clientAssertion(newKey(), "gateway", meta.issuer));
    check("an assertion signed with another key → 401, with the way to authenticate named", foreign.status === 401 && foreign.headers.get("www-authenticate") === 'Basic realm="token", charset="UTF-8"', `${foreign.status} ${foreign.headers.get("www-authenticate") ?? "none"}`);
    check("an assertion made for another server → 401", (await request(clientAssertion(key, "gateway", "https://other.example/"))).status === 401);
    check("an assertion valid for an hour → 401", (await request(clientAssertion(key, "gateway", meta.issuer, { exp: Math.floor(Date.now() / 1000) + 3600 }))).status === 401);
    check("there is no secret to guess: the client id with any secret → 401", (await clientCredentialsToken(mcp.base, "gateway", "x".repeat(48))).status === 401 && (await clientCredentialsToken(mcp.base, "gateway", key.publicPem.slice(0, 60))).status === 401);

    // A token it no longer needs can be given back — by the client it was issued to.
    const issued = await (await request(clientAssertion(key, "gateway", meta.issuer))).json();
    const revoke = (fields) => fetch(`${mcp.base}/revoke`, form({ token: issued.access_token, ...fields }));
    check("naming the client is not enough to revoke its token", (await revoke({ client_id: "gateway" })).status === 401 && (await rawInitialize(mcp.base, { authorization: `Bearer ${issued.access_token}` })).status === 200);
    const revoked = await revoke({ client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer", client_assertion: clientAssertion(key, "gateway", meta.issuer) });
    check("with its key the client revokes its token", revoked.status === 200 && (await rawInitialize(mcp.base, { authorization: `Bearer ${issued.access_token}` })).status === 401, `got ${revoked.status}`);

    const auditLog = path.join(WORKDIR, "logs", "audit.log");
    const audit = fs.existsSync(auditLog) ? fs.readFileSync(auditLog, "utf-8") : "";
    check("refused assertions are in the audit trail", /"action":"client_assertion","outcome":"denied"/.test(audit));
    check("…and so is the revocation", /"action":"client_revocation","outcome":"success"[^\n]*"client":"gateway"/.test(audit));
    check("…and the token says how the client authenticated", /"action":"client_credentials","outcome":"success"[^\n]*"method":"private_key_jwt"/.test(audit));
  } finally {
    await mcp.stop();
  }

  // The private key where the public one belongs.
  const privateFile = path.join(WORKDIR, "gateway.private.pem");
  fs.writeFileSync(privateFile, key.privatePem);
  const mistaken = await startMcp({ ...serviceAccount, MCP_AUTH_SERVICE_CLIENT_ID: "gateway", MCP_AUTH_SERVICE_CLIENT_PUBLIC_KEY_FILE: privateFile });
  try {
    check("a private key configured by mistake disables the client, with a message that says so", /Auth client "gateway" has no usable public key[^\n]*private key/.test(mistaken.output()), mistaken.output().slice(-400));
    const res = await fetch(`${mistaken.base}/token`, form({ grant_type: "client_credentials", client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer", client_assertion: clientAssertion(key, "gateway", `${mistaken.base}/`) }));
    check("…and that client gets no token", res.status === 401 || res.status === 400, `got ${res.status}`);
    check("…while the key itself does not appear in the log", !mistaken.output().includes(key.privatePem.split("\n")[1]));
  } finally {
    await mistaken.stop();
  }
});

// ── Tokens bound to a key of the client ──────────────────────────────────────
await group("Tokens bound to a key of the client (DPoP)", async () => {
  const mcp = await startMcp({ KOMODO_URL: komodo.url });
  const key = newKey();
  const tokenUrl = `${mcp.base}/token`;
  const mcpUrl = `${mcp.base}/mcp`;
  /** Signs in as the reader and redeems the code — with a DPoP proof when a key is given. */
  const signIn = async (proofKey, extra = {}) => {
    const redirectUri = "http://127.0.0.1:9/callback";
    const reg = await (await fetch(`${mcp.base}/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ redirect_uris: [redirectUri], client_name: "E2E DPoP Client", token_endpoint_auth_method: "none" }) })).json();
    const verifier = crypto.randomBytes(32).toString("base64url");
    const authorize = new URL(`${mcp.base}/authorize`);
    authorize.search = new URLSearchParams({ response_type: "code", client_id: reg.client_id, redirect_uri: redirectUri, code_challenge: crypto.createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", state: "st", resource: mcpUrl, ...extra }).toString();
    const { code } = await signInAt(mcp.base, authorize, K.reader);
    const grant = { grant_type: "authorization_code", code, code_verifier: verifier, client_id: reg.client_id, redirect_uri: redirectUri, resource: mcpUrl };
    const redeem = (withKey) => fetch(tokenUrl, form(grant, withKey ? { dpop: dpopProof(withKey, "POST", tokenUrl) } : {}));
    return { clientId: reg.client_id, redeem, tokens: proofKey === null ? undefined : await (await redeem(proofKey)).json() };
  };
  try {
    const meta = await serverMetadata(mcp.base);
    check("the server announces the proof algorithms it accepts", Array.isArray(meta.dpop_signing_alg_values_supported) && meta.dpop_signing_alg_values_supported.includes("ES256"));

    // RFC 9449 §8: a proof has to carry a nonce the server handed out — which a client learns
    // from being asked for it. From here on, every proof carries the nonce learned.
    const asked = await fetch(tokenUrl, form({ grant_type: "client_credentials" }, { authorization: basic(K.reader.key, K.reader.secret), dpop: dpopProof(key, "POST", tokenUrl, undefined, { nonce: null }) }));
    rememberNonce(tokenUrl, asked);
    check("a proof without the server's nonce → 400 use_dpop_nonce, with the nonce to use", asked.status === 400 && (await asked.json()).error === "use_dpop_nonce" && /^[0-9a-z]+\./.test(asked.headers.get("dpop-nonce") ?? ""), `got ${asked.status} ${asked.headers.get("dpop-nonce")}`);

    const { clientId, tokens } = await signIn(key);
    check("a client that proves a key gets a token bound to it", tokens.token_type === "DPoP" && Boolean(tokens.access_token), JSON.stringify(tokens).slice(0, 160));

    const asBearer = await rawInitialize(mcp.base, { authorization: `Bearer ${tokens.access_token}` });
    check("the token alone opens nothing — presented as a bearer token → 401", asBearer.status === 401, `got ${asBearer.status}`);
    const noProof = await rawInitialize(mcp.base, { authorization: `DPoP ${tokens.access_token}` });
    check("without a proof → 401, challenged in the DPoP scheme", noProof.status === 401 && /^DPoP error="invalid_dpop_proof"/.test(noProof.headers.get("www-authenticate") ?? ""), noProof.headers.get("www-authenticate") ?? "");
    const noNonce = await rawInitialize(mcp.base, { authorization: `DPoP ${tokens.access_token}`, dpop: dpopProof(key, "POST", mcpUrl, tokens.access_token, { nonce: null }) });
    check("at the MCP endpoint as well: 401, challenged with use_dpop_nonce and the nonce", noNonce.status === 401 && /^DPoP error="use_dpop_nonce"/.test(noNonce.headers.get("www-authenticate") ?? "") && Boolean(noNonce.headers.get("dpop-nonce")), `${noNonce.status} ${noNonce.headers.get("www-authenticate")}`);
    const madeUp = await rawInitialize(mcp.base, { authorization: `DPoP ${tokens.access_token}`, dpop: dpopProof(key, "POST", mcpUrl, tokens.access_token, { nonce: "made.up" }) });
    check("a nonce the client made up is not taken", madeUp.status === 401 && /use_dpop_nonce/.test(madeUp.headers.get("www-authenticate") ?? ""));
    const thief = newKey();
    const stolen = await rawInitialize(mcp.base, { authorization: `DPoP ${tokens.access_token}`, dpop: dpopProof(thief, "POST", mcpUrl, tokens.access_token) });
    check("with a proof made by another key → 401", stolen.status === 401);

    // The SDK's MCP client over a fetch that adds a fresh proof to every request.
    const session = await connectWithFetch(mcp.base, dpopFetch(tokens.access_token, key));
    const tools = await toolNames(session.client);
    check("with its key, an MCP client works as the person who signed in", tools.includes("komodo_server_list") && !tools.includes("komodo_tag_apply"), tools.join(",").slice(0, 200));
    const listed = await session.client.callTool({ name: "komodo_server_list", arguments: {} });
    check("…tool calls included", listed.isError !== true);
    await session.transport.close();

    const proof = dpopProof(key, "POST", mcpUrl, tokens.access_token);
    const firstUse = await rawInitialize(mcp.base, { authorization: `DPoP ${tokens.access_token}`, dpop: proof });
    const replay = await rawInitialize(mcp.base, { authorization: `DPoP ${tokens.access_token}`, dpop: proof });
    check("a proof works once: recorded and sent again → 401", firstUse.status === 200 && replay.status === 401, `${firstUse.status} then ${replay.status}`);
    const old = await rawInitialize(mcp.base, { authorization: `DPoP ${tokens.access_token}`, dpop: dpopProof(key, "POST", mcpUrl, tokens.access_token, { iat: Math.floor(Date.now() / 1000) - 600 }) });
    check("a proof made ten minutes ago → 401", old.status === 401);
    const otherUrl = await rawInitialize(mcp.base, { authorization: `DPoP ${tokens.access_token}`, dpop: dpopProof(key, "POST", "https://other.example/mcp", tokens.access_token) });
    check("a proof made for another server → 401", otherUrl.status === 401);

    const refresh = (headers) => fetch(tokenUrl, form({ grant_type: "refresh_token", refresh_token: tokens.refresh_token, client_id: clientId }, headers));
    const refreshWithoutKey = await refresh({});
    check("the refresh token is of no use without the key either", refreshWithoutKey.status === 400 && (await refreshWithoutKey.json()).error === "invalid_grant", `got ${refreshWithoutKey.status}`);
    const refreshed = await refresh({ dpop: dpopProof(key, "POST", tokenUrl) });
    const next = await refreshed.json();
    check("…and with the key it yields the next bound token", refreshed.status === 200 && next.token_type === "DPoP", JSON.stringify(next).slice(0, 120));

    // The key named up front: the code itself is bound.
    const announced = await signIn(null, { dpop_jkt: key.thumbprint });
    const codeWithoutKey = await announced.redeem(undefined);
    check("a code requested for a key cannot be redeemed without it", codeWithoutKey.status === 400 && (await codeWithoutKey.json()).error === "invalid_grant", `got ${codeWithoutKey.status}`);
    check("…but with it", (await announced.redeem(key)).status === 200);

    const badProof = await fetch(tokenUrl, form({ grant_type: "client_credentials" }, { authorization: basic(K.reader.key, K.reader.secret), dpop: "not-a-proof" }));
    check("an invalid proof at the token endpoint → 400 invalid_dpop_proof", badProof.status === 400 && (await badProof.json()).error === "invalid_dpop_proof", `got ${badProof.status}`);
    const machine = await fetch(tokenUrl, form({ grant_type: "client_credentials" }, { authorization: basic(K.reader.key, K.reader.secret), dpop: dpopProof(key, "POST", tokenUrl) }));
    check("a Komodo API key can have its token bound as well", machine.status === 200 && (await machine.json()).token_type === "DPoP");

    // Nothing changes for a client that does not ask for it.
    const plain = await signIn(undefined);
    check("a client that sends no proof gets a bearer token as before", plain.tokens.token_type === "bearer" && (await rawInitialize(mcp.base, { authorization: `Bearer ${plain.tokens.access_token}` })).status === 200);
    const bearerAsDpop = await rawInitialize(mcp.base, { authorization: `DPoP ${plain.tokens.access_token}`, dpop: dpopProof(key, "POST", mcpUrl, plain.tokens.access_token) });
    check("a bearer token is not accepted in the DPoP scheme", bearerAsDpop.status === 401);
  } finally {
    await mcp.stop();
  }

  const off = await startMcp({ KOMODO_URL: komodo.url, MCP_AUTH_DPOP: "false" });
  try {
    check("switched off, the server no longer announces it", !("dpop_signing_alg_values_supported" in (await serverMetadata(off.base))));
    const res = await fetch(`${off.base}/token`, form({ grant_type: "client_credentials" }, { authorization: basic(K.reader.key, K.reader.secret), dpop: dpopProof(key, "POST", `${off.base}/token`) }));
    check("…and issues bearer tokens whatever a client sends", res.status === 200 && (await res.json()).token_type === "bearer");
  } finally {
    await off.stop();
  }
});

// ── Secrets never reach the logs ──────────────────────────────────────────────
await group("Secrets stay out of the log output and the audit trail (most verbose logging)", async () => {
  const gatewaySecret = crypto.randomBytes(24).toString("hex");
  const mcp = await startMcp({
    KOMODO_URL: komodo.url, KOMODO_API_KEY: K.svc.key, KOMODO_API_SECRET: K.svc.secret,
    MCP_AUTH_API_KEY_HEADER: "true", MCP_AUTH_SERVICE_CLIENT_ID: "gateway", MCP_AUTH_SERVICE_CLIENT_SECRET: gatewaySecret,
    LOG_LEVEL: "trace", LOG_AUDIT_TOOL_IO: "full",
  });
  try {
    const secrets = {
      "password": K.admin.password, "admin API secret": K.admin.secret,
      "service-account API secret": K.svc.secret, "registered client secret": gatewaySecret,
    };
    const use = async (headers) => {
      const session = await connect(mcp.base, headers);
      await toolNames(session.client);
      await createTag(session.client, "hygiene");
      await session.transport.close();
    };

    // Every way in, each followed by real tool calls…
    const viaKey = await clientCredentialsToken(mcp.base, K.admin.key, K.admin.secret);
    secrets["access token (API key)"] = viaKey.body.access_token;
    await use({ authorization: `Bearer ${viaKey.body.access_token}` });
    const viaClient = await clientCredentialsToken(mcp.base, "gateway", gatewaySecret);
    secrets["access token (registered client)"] = viaClient.body.access_token;
    await use({ authorization: `Bearer ${viaClient.body.access_token}` });
    await use({ "x-api-key": K.admin.key, "x-api-secret": K.admin.secret });
    for (const fields of [
      { method: "password", username: "admin", password: K.admin.password },
      { method: "api-key", username: K.admin.key, password: K.admin.secret },
    ]) {
      const login = await interactiveLogin(mcp.base, fields);
      secrets[`access token (${fields.method} login)`] = login.tokens?.access_token;
      secrets[`refresh token (${fields.method} login)`] = login.tokens?.refresh_token;
      await use({ authorization: `Bearer ${login.tokens.access_token}` });
    }
    // …and the rejected ones, where it is tempting to log what was presented.
    secrets["a rejected API secret"] = K.reader.secret;
    await clientCredentialsToken(mcp.base, K.admin.key, K.reader.secret);
    await clientCredentialsToken(mcp.base, K.reader.secret, K.admin.key);
    await rawInitialize(mcp.base, { "x-api-key": K.admin.key, "x-api-secret": K.reader.secret });

    await new Promise((resolve) => setTimeout(resolve, 300));
    const auditLog = path.join(WORKDIR, "logs", "audit.log");
    const written = mcp.output() + (fs.existsSync(auditLog) ? fs.readFileSync(auditLog, "utf-8") : "");
    const leaked = Object.entries(secrets).filter(([, value]) => value && written.includes(value)).map(([name]) => name);
    check("the run produced log output and audit entries to inspect", mcp.output().length > 1000 && /"action":"login"/.test(written));
    check("no password, secret or token in anything the server wrote", leaked.length === 0, leaked.join(", "));
    check("no Komodo JWT in anything the server wrote", !/eyJ[\w-]{8,}\.eyJ[\w-]{8,}\./.test(written));
  } finally {
    await mcp.stop();
  }
});

// ── 5. Regression: GHSA-gf32-w3f6-crx6 ────────────────────────────────────────
await group("GHSA-gf32-w3f6-crx6 regression (auth off + admin service credentials on the server)", async () => {
  const mcp = await startMcp({ KOMODO_URL: komodo.url, KOMODO_API_KEY: K.svc.key, KOMODO_API_SECRET: K.svc.secret, MCP_AUTH_ENABLED: "false" });
  try {
    check("start-up announces READ-ONLY", /READ-ONLY/.test(mcp.output()));
    const before = (await komodo.state()).writes.length;
    const anon = await connect(mcp.base); // PoC step 1: session without any credential
    const tools = await toolNames(anon.client); // PoC step 2
    check("anonymous session is still possible (read-only mode)", tools.includes("komodo_server_list"));
    check("PoC step 3: komodo_exec is NOT listed", !tools.includes("komodo_exec"));
    check("no write tool is listed at all", !tools.some((t) => /_apply$|_delete$|_action$|^komodo_exec$/.test(t)), tools.filter((t) => /_apply$|_delete$|_action$/.test(t)).join(","));
    check("PoC step 4: calling komodo_exec is rejected", await isToolError(anon.client.callTool({ name: "komodo_exec", arguments: { target: "server", server: "s1", command: "id" } })));
    check("calling a write tool is rejected", await isToolError(createTag(anon.client, "from-anonymous")));
    check("Komodo received no write", (await komodo.state()).writes.length === before);
    await anon.transport.close();

    check("the new token endpoint does not exist in this mode", (await clientCredentialsToken(mcp.base, K.admin.key, K.admin.secret).catch(() => ({ status: 404 }))).status !== 200);
    const withHeaders = await connect(mcp.base, { "x-api-key": K.admin.key, "x-api-secret": K.admin.secret });
    check("API-key headers do not lift read-only when auth is off", !(await toolNames(withHeaders.client)).includes("komodo_exec"));
    await withHeaders.transport.close();
  } finally {
    await mcp.stop();
  }

  // The switch for header credentials must not turn into a way around this either.
  const both = await startMcp({ KOMODO_URL: komodo.url, KOMODO_API_KEY: K.svc.key, KOMODO_API_SECRET: K.svc.secret, MCP_AUTH_ENABLED: "false", MCP_AUTH_API_KEY_HEADER: "true", MCP_AUTH_SERVICE_CLIENT_ID: "gateway", MCP_AUTH_SERVICE_CLIENT_SECRET: "z".repeat(48) });
  try {
    const anon = await connect(both.base);
    check("auth off + every new option set: anonymous callers are still read-only", !(await toolNames(anon.client)).includes("komodo_exec"));
    await anon.transport.close();
  } finally {
    await both.stop();
  }
});

// ── 6. Regression: stdio ──────────────────────────────────────────────────────
await group("stdio regression (local, trusted, unrestricted)", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath, args: [SERVER_ENTRY], cwd: WORKDIR,
    env: { ...BASE_ENV, MCP_TRANSPORT: "stdio", KOMODO_URL: komodo.url, KOMODO_API_KEY: K.svc.key, KOMODO_API_SECRET: K.svc.secret },
    stderr: "ignore",
  });
  const client = new Client({ name: "e2e-stdio", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
  const tools = await toolNames(client);
  check("all tools available, including komodo_exec", tools.includes("komodo_exec") && tools.includes("komodo_tag_apply"), `${tools.length} tools`);
  check("write works with the global credentials", (await createTag(client, "from-stdio")).isError !== true && (await komodo.state()).writes.at(-1)?.as === "mcp-service");
  await transport.close();
});

// ── 7. Plain-HTTP public URL ──────────────────────────────────────────────────
await group("Plain-HTTP public URL (overlay networks)", async () => {
  const refused = await startMcp({ KOMODO_URL: komodo.url, MCP_BASE_URL: "http://100.64.0.5:8000", MCP_ALLOWED_HOSTS: "127.0.0.1" });
  check("server refuses to start", refused.exitCode !== undefined && refused.exitCode !== 0, `exit=${refused.exitCode}`);
  check("…with a message naming MCP_BASE_URL and the explicit switch", /not HTTPS/.test(refused.output()) && /MCP_BASE_URL/.test(refused.output()) && /MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL/.test(refused.output()), refused.output().slice(-500));
  await refused.stop();

  const allowed = await startMcp({ KOMODO_URL: komodo.url, MCP_BASE_URL: "http://100.64.0.5:8000", MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL: "true" });
  try {
    check("with the switch the server starts", allowed.exitCode === undefined, allowed.output().slice(-300));
    check("…and logs a SECURITY warning", /SECURITY: the OAuth issuer/.test(allowed.output()));
  } finally {
    await allowed.stop();
  }
});

await komodo.close();
fs.rmSync(WORKDIR, { recursive: true, force: true });

// ── summary ──────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
for (const f of failed) console.log(`FAILED [${f.group}] ${f.name}\n   ${f.detail}`);
process.exit(failed.length === 0 ? 0 : 1);
