// A stand-in for an OpenID Connect provider (Authentik, Keycloak, …): discovery, signing
// keys, an authorization endpoint that approves at once for whoever is "signed in" at the
// provider, the token endpoint (PKCE, client secret) and UserInfo. Node built-ins only.
import crypto from "node:crypto";
import http from "node:http";

const b64 = (value) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");

/**
 * @param client - The OAuth client registered at this provider: `{ id, secret }`
 */
export function startFakeOidc(client) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: "jwk" }), kid: "e2e-key", alg: "RS256", use: "sig" };
  const codes = new Map();
  const session = { subject: undefined };
  let issuer = "";

  const sign = (claims) => {
    const signed = `${b64({ alg: "RS256", kid: jwk.kid, typ: "JWT" })}.${b64(claims)}`;
    return `${signed}.${crypto.sign("RSA-SHA256", Buffer.from(signed), privateKey).toString("base64url")}`;
  };
  /** An ID token of this provider — `overrides` replace claims (e.g. another audience). */
  const idToken = (subject, overrides = {}) => {
    const now = Math.floor(Date.now() / 1000);
    return sign({ iss: issuer, sub: subject, aud: client.id, iat: now, exp: now + 300, preferred_username: subject.replace(/-sub$/, ""), ...overrides });
  };

  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (chunk) => (raw += chunk));
    req.on("end", () => {
      const url = new URL(req.url ?? "/", issuer);
      const json = (status, value) => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(value));
      };

      if (url.pathname === "/.well-known/openid-configuration") {
        return void json(200, {
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          userinfo_endpoint: `${issuer}/userinfo`,
          jwks_uri: `${issuer}/jwks`,
          id_token_signing_alg_values_supported: ["RS256"],
          token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic"],
          code_challenge_methods_supported: ["S256"],
        });
      }
      if (url.pathname === "/jwks") return void json(200, { keys: [jwk] });

      if (url.pathname === "/authorize") {
        // The person already has a session at the provider (single sign-on): it approves at once.
        if (!session.subject) return void json(401, { error: "nobody is signed in at the provider" });
        if (url.searchParams.get("client_id") !== client.id) return void json(400, { error: "unknown client" });
        const code = crypto.randomUUID();
        codes.set(code, { subject: session.subject, nonce: url.searchParams.get("nonce"), challenge: url.searchParams.get("code_challenge") });
        const back = new URL(url.searchParams.get("redirect_uri"));
        back.searchParams.set("code", code);
        back.searchParams.set("state", url.searchParams.get("state"));
        res.writeHead(302, { location: back.toString() });
        return void res.end();
      }

      if (url.pathname === "/token" && req.method === "POST") {
        const form = new URLSearchParams(raw);
        const grant = codes.get(form.get("code"));
        codes.delete(form.get("code"));
        const pkce = grant?.challenge === crypto.createHash("sha256").update(form.get("code_verifier") ?? "").digest("base64url");
        if (!grant || !pkce || form.get("client_id") !== client.id || form.get("client_secret") !== client.secret) {
          return void json(400, { error: "invalid_grant" });
        }
        return void json(200, {
          access_token: `idp-access-token-of-${grant.subject}`,
          token_type: "Bearer",
          expires_in: 3600,
          id_token: idToken(grant.subject, { nonce: grant.nonce }),
        });
      }

      if (url.pathname === "/userinfo") {
        const subject = /^Bearer idp-access-token-of-(.+)$/.exec(req.headers.authorization ?? "")?.[1];
        return subject ? void json(200, { sub: subject, email: `${subject}@example.test` }) : void json(401, { error: "invalid_token" });
      }
      json(404, { error: "not found" });
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      issuer = `http://127.0.0.1:${server.address().port}`;
      resolve({
        issuer,
        jwk,
        /** Who is signed in at the provider when a browser arrives at its authorization endpoint. */
        signIn: (subject) => (session.subject = subject),
        idToken,
        close: () => new Promise((done) => { server.closeAllConnections(); server.close(done); }),
      });
    });
  });
}
