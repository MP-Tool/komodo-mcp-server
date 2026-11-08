// What a client with a key needs in the end-to-end checks — with nothing but Node itself:
// key pairs, signed JWTs (client assertions, DPoP proofs), and a small HTTPS server that
// publishes client metadata documents the way a client's website would.
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import https from "node:https";
import path from "node:path";

const b64url = (value) => Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("base64url");

/** A fresh EC P-256 key pair in every form the checks use. */
export function newKey() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
  const publicJwk = publicKey.export({ format: "jwk" });
  return {
    privateKey,
    privatePem: privateKey.export({ type: "pkcs8", format: "pem" }),
    publicPem: publicKey.export({ type: "spki", format: "pem" }),
    publicJwk,
    // RFC 7638: SHA-256 over the required members, in lexicographic order, without whitespace.
    thumbprint: sha256(JSON.stringify({ crv: publicJwk.crv, kty: publicJwk.kty, x: publicJwk.x, y: publicJwk.y })),
  };
}

/** Signs a JWT with ES256. */
export function signJwt(header, payload, privateKey) {
  const signingInput = `${b64url({ alg: "ES256", ...header })}.${b64url(payload)}`;
  const signature = crypto.sign("sha256", Buffer.from(signingInput), { key: privateKey, dsaEncoding: "ieee-p1363" });
  return `${signingInput}.${signature.toString("base64url")}`;
}

/** The nonce each server last handed out, by origin — what a DPoP client keeps (RFC 9449 §8). */
const nonces = new Map();

/** Keeps the nonce a server named in its answer (`DPoP-Nonce`) for the next proof to it. */
export function rememberNonce(url, response) {
  const nonce = response.headers.get("dpop-nonce");
  if (nonce) nonces.set(new URL(url).origin, nonce);
  return response;
}

/**
 * A DPoP proof (RFC 9449 §4.2) for one request — and, with `accessToken`, for that token. It
 * carries the nonce the server last handed out, unless `overrides.nonce` says otherwise
 * (`null`: none).
 */
export function dpopProof(key, method, url, accessToken, overrides = {}) {
  const { nonce: explicit, ...rest } = overrides;
  const nonce = explicit === null ? undefined : (explicit ?? nonces.get(new URL(url).origin));
  return signJwt(
    { typ: "dpop+jwt", jwk: key.publicJwk },
    {
      jti: crypto.randomUUID(),
      htm: method,
      htu: url,
      iat: Math.floor(Date.now() / 1000),
      ...(accessToken !== undefined && { ath: sha256(accessToken) }),
      ...(nonce !== undefined && { nonce }),
      ...rest,
    },
    key.privateKey,
  );
}

/** A client assertion (RFC 7523 §2.2) of `clientId` for the server whose issuer is `audience`. */
export function clientAssertion(key, clientId, audience, overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  return signJwt(
    {},
    { iss: clientId, sub: clientId, aud: audience, iat: now, exp: now + 60, jti: crypto.randomUUID(), ...overrides },
    key.privateKey,
  );
}

/**
 * A certificate for the loopback interface, made with openssl. Returns `undefined` where
 * there is no openssl — the checks that need a TLS server are then skipped, visibly.
 */
export function loopbackCertificate(dir) {
  const keyPath = path.join(dir, "site.key.pem");
  const certPath = path.join(dir, "site.cert.pem");
  try {
    execFileSync(
      "openssl",
      [
        ...["req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes"],
        ...["-keyout", keyPath, "-out", certPath, "-days", "1", "-subj", "/CN=localhost"],
        ...["-addext", "subjectAltName=DNS:localhost,IP:127.0.0.1"],
      ],
      { stdio: "ignore" },
    );
  } catch {
    return undefined;
  }
  return { keyPath, certPath };
}

/**
 * A website that publishes documents: `routes` maps a path to what is served there — a
 * JSON value, or a function `(origin) => ({ status, headers, body })` for anything else.
 * A JSON value may be given as a function of the site's origin as well, since a client
 * metadata document has to name its own URL.
 */
export async function startSite(certificate, routes) {
  const requests = [];
  const server = https.createServer(
    { key: fs.readFileSync(certificate.keyPath), cert: fs.readFileSync(certificate.certPath) },
    (req, res) => {
      const pathname = (req.url ?? "/").split("?")[0];
      requests.push(pathname);
      const route = routes[pathname];
      if (route === undefined) {
        res.writeHead(404, { "content-type": "application/json" }).end("{}");
        return;
      }
      const value = typeof route === "function" ? route(origin) : route;
      if (value && typeof value === "object" && "status" in value && "body" in value) {
        res.writeHead(value.status, value.headers ?? {}).end(value.body);
        return;
      }
      res.writeHead(200, { "content-type": "application/json", "cache-control": "max-age=300" }).end(JSON.stringify(value));
    },
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `https://127.0.0.1:${server.address().port}`;
  return {
    origin,
    requests,
    close: async () => {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
