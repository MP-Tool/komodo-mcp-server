import { test } from "node:test";
import assert from "node:assert/strict";
import { SecretScrubber } from "mcp-server-framework/logger";
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

test("policy: env-block strings and Config.Env arrays are scrubbed by the heuristics", () => {
  const out = scrubber.scrubObject({
    config: { environment: "HOST=h\nAPI_KEY=abc123\nDB_PASSWORD=hunter2" },
    Config: { Env: ["HOST=localhost", "API_KEY=abc123"] },
  }) as any;
  assert.doesNotMatch(out.config.environment, /abc123|hunter2/);
  assert.match(out.config.environment, /HOST=h/);
  assert.doesNotMatch(out.Config.Env.join("\n"), /abc123/);
});
