// A stand-in for Komodo Core 2.3.x: just enough of the HTTP API for the MCP server to
// authenticate users and run a read and a write tool. It records who performed each write,
// which is what the end-to-end checks assert on ("acts as exactly that Komodo user").
import crypto from "node:crypto";
import http from "node:http";

const key = (name) => `K_${name.padEnd(40, "0").slice(0, 40)}_K`;
const secret = (name) => `S_${name.padEnd(40, "0").slice(0, 40)}_S`;

/** Two deployments, so a grant on one of them can be told apart from a grant on the whole kind. */
export const DEPLOYMENTS = [
  { id: "0000000000000000000000a1", name: "app" },
  { id: "0000000000000000000000b2", name: "db" },
];

const LEVELS = ["None", "Read", "Execute", "Write"];

export const USERS = {
  admin: { id: "u-admin", username: "admin", password: "admin-pass", enabled: true, admin: true, key: key("admin"), secret: secret("admin") },
  reader: { id: "u-reader", username: "reader", password: "reader-pass", enabled: true, admin: false, all: { Server: "Read" }, key: key("reader"), secret: secret("reader") },
  svc: { id: "u-svc", username: "mcp-service", password: undefined, enabled: true, admin: true, key: key("svc"), secret: secret("svc") },
  gone: { id: "u-gone", username: "gone", password: "gone-pass", enabled: false, admin: true, key: key("gone"), secret: secret("gone") },
  // The limited service account of issue #182: may read servers and deployments, and operate exactly one deployment.
  operator: { id: "u-operator", username: "operator", password: undefined, enabled: true, admin: false, all: { Server: "Read", Deployment: "Read" }, grants: { [DEPLOYMENTS[0].id]: "Execute" }, key: key("operator"), secret: secret("operator") },
  // A key in the shape Komodo 1.x minted (K-… / S-…) — such keys stay valid after an upgrade to 2.x.
  // People whose Komodo account signs in through the identity provider (linked by its subject).
  carol: { id: "u-carol", username: "carol", password: undefined, enabled: true, admin: false, oidc: "carol-sub", all: { Server: "Read", Deployment: "Read" }, grants: { [DEPLOYMENTS[0].id]: "Execute" }, key: key("carol"), secret: secret("carol") },
  erin: { id: "u-erin", username: "erin", password: undefined, enabled: true, admin: false, oidc: "erin-sub", twoFactor: true, all: { Server: "Read" }, key: key("erin"), secret: secret("erin") },
  frank: { id: "u-frank", username: "frank", password: undefined, enabled: false, admin: false, oidc: "frank-sub", all: { Server: "Read" }, key: key("frank"), secret: secret("frank") },
  legacy: { id: "u-legacy", username: "legacy", password: undefined, enabled: true, admin: false, all: { Server: "Read" }, key: `K-${"legacy".padEnd(40, "0")}`, secret: `S-${"legacy".padEnd(40, "0")}` },
};

const TOKEN_EXCHANGE = "urn:ietf:params:oauth:grant-type:token-exchange";
const TOKEN_TYPE = (name) => `urn:ietf:params:oauth:token-type:${name}`;

/**
 * @param options.localAuth - Whether username/password login is on
 * @param options.tokenExchange - Makes this a Komodo Core that has the RFC 8693 token exchange
 *   (`POST /auth/token`) enabled for one OIDC provider: `{ issuer, jwk, audiences }`. Without
 *   it the endpoint does not exist, as in Komodo Core 2.3.
 */
export function startFakeKomodo({ localAuth = true, tokenExchange } = {}) {
  const jwts = new Map();
  const writes = [];
  const exchanges = [];
  let authFailures = 0;

  /** The claims of a provider-signed token, or `undefined` when its signature does not verify. */
  const verified = (token) => {
    const [head, payload, signature] = token.split(".");
    try {
      const key = crypto.createPublicKey({ key: tokenExchange.jwk, format: "jwk" });
      const ok = JSON.parse(Buffer.from(head, "base64url")).alg === "RS256" && crypto.verify("RSA-SHA256", Buffer.from(`${head}.${payload}`), key, Buffer.from(signature, "base64url"));
      return ok ? JSON.parse(Buffer.from(payload, "base64url")) : undefined;
    } catch {
      return undefined;
    }
  };

  const mintJwt = (user) => {
    const enc = (v) => Buffer.from(JSON.stringify(v)).toString("base64url");
    const now = Date.now();
    const jwt = `${enc({ alg: "HS256" })}.${enc({ sub: user.id, iat: now, exp: now + 24 * 3600 * 1000 })}.sig${jwts.size}`;
    jwts.set(jwt, user);
    return jwt;
  };

  const whoIs = (req) => {
    const authorization = req.headers["authorization"];
    if (authorization) return jwts.get(authorization.replace(/^Bearer /, ""));
    const k = req.headers["x-api-key"];
    const s = req.headers["x-api-secret"];
    return Object.values(USERS).find((u) => u.key === k && u.secret === s);
  };

  const publicUser = (u) => ({
    _id: { $oid: u.id }, username: u.username, enabled: u.enabled, admin: u.admin, super_admin: false,
    create_server_permissions: false, create_build_permissions: false, all: u.all ?? {},
    config: u.oidc ? { type: "Oidc", data: { provider: "oidc", user_id: u.oidc } } : { type: "Local", data: { password: "########" } },
  });

  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const isForm = (req.headers["content-type"] ?? "").includes("x-www-form-urlencoded");
      const body = raw && !isForm ? JSON.parse(raw) : {};
      const json = (status, value) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(value));
      };
      const unauthorized = () => {
        authFailures++;
        json(401, { error: "Invalid user credentials", trace: [] });
      };
      const url = req.url ?? "";

      if (url === "/version") return void res.end("2.3.1");
      if (url === "/__state") return void json(200, { writes, authFailures, exchanges });

      // RFC 8693 token exchange, as the auth library of newer Komodo Core serves it: a token the
      // provider signed, issued to a client id Komodo trusts, for a user already linked to it.
      if (url === "/auth/token") {
        if (!tokenExchange) {
          res.writeHead(405);
          return void res.end();
        }
        const oauth = (status, error, error_description) => {
          res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
          res.end(JSON.stringify({ error, error_description }));
        };
        const request = new URLSearchParams(raw);
        if (request.get("grant_type") !== TOKEN_EXCHANGE) return void oauth(400, "unsupported_grant_type", "Only token exchange is supported");
        const token = request.get("subject_token");
        if (!token || ![TOKEN_TYPE("id_token"), TOKEN_TYPE("jwt")].includes(request.get("subject_token_type"))) {
          return void oauth(400, "invalid_request", "'subject_token_type' must be an id_token or jwt. Only tokens signed by the provider can be exchanged.");
        }
        const claims = verified(token);
        const audiences = [claims?.aud].flat();
        if (!claims || claims.iss !== tokenExchange.issuer || claims.exp * 1000 < Date.now() || !audiences.some((aud) => tokenExchange.audiences.includes(aud))) {
          return void oauth(400, "invalid_grant", "Token was rejected");
        }
        const user = Object.values(USERS).find((u) => u.oidc === claims.sub);
        if (!user) return void oauth(400, "invalid_grant", "No user is linked to this login");
        if (user.twoFactor) {
          return void oauth(400, "invalid_grant", "The user requires a second factor for external logins, which this endpoint can't provide. Use 'ExchangeExternalForJwt' of the login api instead.");
        }
        exchanges.push({ subject: claims.sub, as: user.username, audience: claims.aud });
        res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
        return void res.end(JSON.stringify({ access_token: mintJwt(user), issued_token_type: TOKEN_TYPE("access_token"), token_type: "Bearer", expires_in: 86400 }));
      }

      if (url === "/auth/login/GetLoginOptions") {
        return void json(200, { local: localAuth, oidc: !localAuth, github: false, google: false, registration_disabled: true, oidc_auto_redirect: false });
      }
      if (url === "/auth/login/LoginLocalUser") {
        const user = Object.values(USERS).find((u) => u.username === body.username && u.password && u.password === body.password);
        if (!localAuth || !user) return void unauthorized();
        return void json(200, { type: "Jwt", data: { jwt: mintJwt(user) } });
      }

      // Everything below requires an authenticated, enabled user — as in Komodo Core.
      const user = whoIs(req);
      if (!user) return void unauthorized();
      if (url === "/user") return void json(200, publicUser(user));
      if (!user.enabled) return void unauthorized();

      if (url === "/read/GetVersion") return void json(200, { version: "2.3.1" });
      if (url === "/read/ListPermissions") {
        return void json(200, Object.entries(user.grants ?? {}).map(([id, level]) => ({ resource_target: { type: "Deployment", id }, level, specific: [] })));
      }
      // As Komodo Core 2.3 answers: an object for admins, the BARE level for everyone else — and
      // a grant on one resource counts only when asked by its id; a name gets the base level.
      if (url === "/read/GetPermission") {
        if (user.admin) return void json(200, { level: "Write", specific: ["Terminal", "Attach", "Inspect", "Logs", "Processes"] });
        const base = user.all?.[body.target?.type] ?? "None";
        const granted = user.grants?.[body.target?.id] ?? "None";
        return void json(200, LEVELS[Math.max(LEVELS.indexOf(base), LEVELS.indexOf(granted))]);
      }
      if (url === "/read/ListDeployments") {
        const canSee = (d) => user.admin || (user.all?.Deployment ?? "None") !== "None" || user.grants?.[d.id];
        const names = body.query?.names;
        return void json(200, DEPLOYMENTS.filter((d) => canSee(d) && (!names?.length || names.includes(d.name))).map((d) => ({ id: d.id, name: d.name, info: { state: "not_deployed" } })));
      }
      if (url === "/read/ListServers") {
        return void json(200, [{ id: "s1", name: "prod-1", info: { state: "Ok", version: "2.3.1", region: "" } }]);
      }
      if (url.startsWith("/read/")) return void json(200, []);

      if (url === "/execute/StopDeployment") {
        // Komodo resolves the name itself and enforces the permission on the resolved resource.
        const deployment = DEPLOYMENTS.find((d) => d.id === body.deployment || d.name === body.deployment);
        if (!deployment) return void json(404, { error: `Did not find any Deployment matching ${body.deployment}`, trace: [] });
        const level = user.admin ? "Write" : (user.grants?.[deployment.id] ?? "None");
        if (LEVELS.indexOf(level) < LEVELS.indexOf("Execute")) return void json(403, { error: "User does not have required permissions", trace: [] });
        writes.push({ op: url, as: user.username, target: deployment.name });
        return void json(200, { _id: { $oid: "0000000000000000000000f1" }, operation: "StopDeployment", status: "Complete", success: true, operator: user.id, target: { type: "Deployment", id: deployment.id }, logs: [], start_ts: Date.now(), end_ts: Date.now() });
      }

      if (url.startsWith("/write/") || url.startsWith("/execute/")) {
        // Komodo's own authorization: only admins may write here.
        if (!user.admin) return void json(403, { error: "User does not have required permissions", trace: [] });
        writes.push({ op: url, as: user.username });
        if (url === "/write/CreateTag") return void json(200, { _id: { $oid: "t1" }, name: body.name, owner: user.id, color: "Slate" });
        return void json(200, {});
      }
      json(404, { error: "not found", trace: [] });
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const url = `http://127.0.0.1:${server.address().port}`;
      resolve({
        url,
        state: async () => (await fetch(`${url}/__state`)).json(),
        close: () => new Promise((done) => { server.closeAllConnections(); server.close(done); }),
      });
    });
  });
}
