import { test } from "node:test";
import assert from "node:assert/strict";
import { parse as tomlParse } from "smol-toml";
import { SecretScrubber, scrubByMimeType } from "mcp-server-framework/logger";
import { REDACTED, KOMODO_SCRUB_ALLOW_KEYS, KOMODO_SCRUB_RULES } from "./redact.js";

// ============================================================================
// Contract tests: the Komodo POLICY applied by the framework engine.
//
// The scrub implementation lives in the framework (tool-result boundary +
// dynamic-resource registry + log notifications, wired in src/index.ts). These
// tests pin the contract: the engine, configured with exactly the policy this
// module declares, redacts Komodo's domain shapes and spares benign fields.
// ============================================================================

const scrubber = new SecretScrubber({ ...KOMODO_SCRUB_RULES, allowKeys: [...KOMODO_SCRUB_ALLOW_KEYS] });

// --- Alerter endpoint (sensitivePaths) ---------------------------------------

test("policy: alerter endpoint url and email are masked (path-scoped)", () => {
  const out = scrubber.scrubObject({
    config: { endpoint: { type: "Slack", params: { url: "https://hooks.slack.com/services/T/B/xyz" } } },
  }) as any;
  assert.equal(out.config.endpoint.params.url, REDACTED);
  const ntfy = scrubber.scrubObject({
    config: { endpoint: { type: "Ntfy", params: { url: "https://ntfy.sh/x", email: "a@b.com" } } },
  }) as any;
  assert.equal(ntfy.config.endpoint.params.email, REDACTED);
});

test("policy: ordinary urls outside the endpoint path stay readable", () => {
  const out = scrubber.scrubObject({ config: { address: "https://periphery:8120" }, url: "https://docs.x" }) as any;
  assert.equal(out.config.address, "https://periphery:8120");
  assert.equal(out.url, "https://docs.x");
});

// --- Stack deploy artifacts (dropKeys) ---------------------------------------

test("policy: stack deployed_config/deployed_contents are dropped, source config retained", () => {
  const out = scrubber.scrubObject({
    config: { file_contents: "services: {}", environment: "HOST=db.local" },
    info: {
      deployed_config: "services:\n  env: EXPANDED_SECRET_42",
      deployed_contents: [{ path: "c.yaml", contents: "expanded-secret-43" }],
      state: "running",
    },
  }) as any;
  assert.ok(!("deployed_config" in out.info));
  assert.ok(!("deployed_contents" in out.info));
  assert.equal(out.info.state, "running");
  assert.equal(out.config.file_contents, "services: {}");
  assert.equal(out.config.environment, "HOST=db.local");
});

// --- Variable is_secret (maskWhenSibling) ------------------------------------

test("policy: is_secret variables have their value masked, flag survives", () => {
  const out = scrubber.scrubObject({ name: "API_TOKEN_VAR", is_secret: true, value: "super-secret-1" }) as any;
  assert.equal(out.value, REDACTED);
  assert.equal(out.is_secret, true);
  assert.equal(out.name, "API_TOKEN_VAR");
});

test("policy: non-secret variables pass through", () => {
  const out = scrubber.scrubObject({ name: "REGION", is_secret: false, value: "eu-west-1" }) as any;
  assert.equal(out.value, "eu-west-1");
});

// --- Allowlist + generic heuristics still compose ----------------------------

test("policy: allowlisted public-key/flag fields survive, generic secrets stay redacted", () => {
  const out = scrubber.scrubObject({
    info: { public_key: "ssh-ed25519 AAAA...", attempted_public_key: "ssh-ed25519 BBBB..." },
    config: { webhook_secret: "shh", skip_secret_interp: true, passkey: "periphery-pass-1" },
  }) as any;
  assert.equal(out.info.public_key, "ssh-ed25519 AAAA...");
  assert.equal(out.info.attempted_public_key, "ssh-ed25519 BBBB...");
  assert.equal(out.config.skip_secret_interp, true);
  assert.notEqual(out.config.webhook_secret, "shh");
  assert.notEqual(out.config.passkey, "periphery-pass-1");
});

test("policy: the boolean `secrets_masked` flag survives (not masked into a string)", () => {
  // Regression: the substring "secret" would redact this flag, turning `true` into a
  // placeholder string and breaking the toml-export tools' boolean output validation.
  const out = scrubber.scrubObject({ summary: { bytes: 1234, secrets_masked: true }, api_secret: "shh" }) as any;
  assert.equal(out.summary.secrets_masked, true);
  assert.notEqual(out.api_secret, "shh");
});

test("policy: env-block strings and Config.Env arrays are scrubbed by the heuristics", () => {
  const out = scrubber.scrubObject({
    config: { environment: "HOST=h\nAPI_KEY=abc123\nDB_PASSWORD=hunter2" },
    Config: { Env: ["HOST=localhost", "API_KEY=abc123"] },
  }) as any;
  assert.doesNotMatch(out.config.environment, /abc123|hunter2/);
  assert.match(out.config.environment, /HOST=h/);
  assert.doesNotMatch(out.Config.Env.join("\n"), /abc123/);
});

// --- Sync-TOML export (structural scrub via mimeType) -------------------------
//
// The export is a STRUCTURED document delivered as a string. Declaring it
// `application/toml` is what makes the policy above apply; under `text/plain`
// the framework falls back to regex redaction, which misses every rule here.
// Komodo Core does NOT protect this payload — it masks only variable values,
// and only for non-admin callers.

const KOMODO_EXPORT_TOML = `[[variable]]
name = "DB_PASSWORD"
value = "hunter2-actual-production-password"
is_secret = true

[[variable]]
name = "PUBLIC_HOST"
value = "example.com"
is_secret = false

[[server]]
name = "prod-1"

[server.config]
address = "https://periphery.internal:8120"
passkey = "example-passkey-must-be-masked"

[[alerter]]
name = "slack-prod"

[alerter.endpoint.params]
url = "https://hooks.slack.com/services/T00/B00/SECRETWEBHOOK"
`;

test("policy(toml): secret variable values, passkeys and webhook urls are all masked", () => {
  const out = scrubByMimeType(KOMODO_EXPORT_TOML, "application/toml", scrubber);
  assert.doesNotMatch(out, /hunter2-actual-production-password/);
  assert.doesNotMatch(out, /example-passkey-must-be-masked/);
  assert.doesNotMatch(out, /SECRETWEBHOOK/);
});

test("policy(toml): non-secret values and identifying fields stay readable", () => {
  const out = scrubByMimeType(KOMODO_EXPORT_TOML, "application/toml", scrubber);
  assert.match(out, /example\.com/);
  assert.match(out, /prod-1/);
  assert.match(out, /periphery\.internal/);
});

test("policy(toml): the is_secret flag stays a boolean and the document still parses", () => {
  const out = scrubByMimeType(KOMODO_EXPORT_TOML, "application/toml", scrubber);
  const parsed = tomlParse(out) as any;
  assert.equal(parsed.variable[0].is_secret, true);
  assert.equal(parsed.variable[1].is_secret, false);
  assert.equal(parsed.variable[0].value, REDACTED);
});

test("policy(toml): text/plain is NOT equivalent — guards the mimeType contract", () => {
  // Pins the reason `tools/toml.ts` must declare application/toml. If this ever
  // stops leaking, the text path gained structure and the tool can be revisited.
  const asText = scrubByMimeType(KOMODO_EXPORT_TOML, "text/plain", scrubber);
  assert.match(asText, /hunter2-actual-production-password/);
});
