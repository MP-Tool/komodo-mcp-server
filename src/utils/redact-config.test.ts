import { test } from "node:test";
import assert from "node:assert/strict";

// ============================================================================
// Scrub-configuration composition: framework BASE ← Komodo EXTENSION.
//
// The framework's `MCP_SCRUB_*` provide the base layer; Komodo's
// `MCP_SECRET_SCRUB_*` extend it and win on conflict. Key lists are unioned so
// neither layer can silently narrow the other, and the Komodo domain rules stay
// attached to every enabled outcome regardless of which switch enabled it.
//
// The env vars feeding this are read through process-wide caches that cannot be
// re-resolved inside one process, so the switch matrix is exercised through the
// pure `resolveRedactionSwitch()` and the key union through `resolveScrubOptions()`
// under the module-scope environment set below.
// ============================================================================

process.env["MCP_SCRUB_ADDITIONAL_KEYS"] = "fw_extra_key";
process.env["MCP_SCRUB_ALLOW_KEYS"] = "fw_allowed";
process.env["MCP_SECRET_SCRUB_KEYS"] = "komodo_extra_key";
process.env["MCP_SECRET_SCRUB_ALLOW_KEYS"] = "komodo_allowed";
delete process.env["MCP_SCRUB_ENABLED"];
delete process.env["MCP_SECRET_SCRUB_ENABLED"];

const { resolveRedactionSwitch, resolveScrubOptions, KOMODO_SCRUB_ALLOW_KEYS, KOMODO_SCRUB_RULES } =
  await import("./redact.js");

// --- Master switch precedence ------------------------------------------------

test("switch: neither layer set ⇒ redaction on (security default)", () => {
  assert.equal(resolveRedactionSwitch(undefined, undefined), true);
});

test("switch: framework base applies when Komodo is unset", () => {
  assert.equal(resolveRedactionSwitch(undefined, false), false);
  assert.equal(resolveRedactionSwitch(undefined, true), true);
});

test("switch: Komodo overrides the framework base in both directions", () => {
  assert.equal(resolveRedactionSwitch(false, true), false); // Komodo turns it off
  assert.equal(resolveRedactionSwitch(true, false), true); // Komodo turns it back on
});

test("switch: Komodo set to the same value as the base is a no-op", () => {
  assert.equal(resolveRedactionSwitch(true, true), true);
  assert.equal(resolveRedactionSwitch(false, false), false);
});

// --- Key composition ---------------------------------------------------------

test("keys: additionalKeys unions the framework base with the Komodo extension", () => {
  const opts = resolveScrubOptions();
  assert.notEqual(opts, false);
  const { additionalKeys } = opts as { additionalKeys: string[] };
  assert.ok(additionalKeys.includes("fw_extra_key"), "framework key missing");
  assert.ok(additionalKeys.includes("komodo_extra_key"), "Komodo key missing");
});

test("keys: allowKeys unions framework, built-in Komodo allowlist and the Komodo extension", () => {
  const { allowKeys } = resolveScrubOptions() as { allowKeys: string[] };
  assert.ok(allowKeys.includes("fw_allowed"), "framework allow key missing");
  assert.ok(allowKeys.includes("komodo_allowed"), "Komodo allow key missing");
  for (const builtin of KOMODO_SCRUB_ALLOW_KEYS) {
    assert.ok(allowKeys.includes(builtin), `built-in allow key ${builtin} missing`);
  }
});

test("rules: the Komodo domain rules survive composition", () => {
  // The framework's resolveScrubConfig() drops these when the base is `false`;
  // composing here is what keeps them attached however redaction got enabled.
  const opts = resolveScrubOptions() as Record<string, unknown>;
  assert.deepEqual(opts["dropKeys"], KOMODO_SCRUB_RULES.dropKeys);
  assert.deepEqual(opts["sensitivePaths"], KOMODO_SCRUB_RULES.sensitivePaths);
  assert.deepEqual(opts["maskWhenSibling"], KOMODO_SCRUB_RULES.maskWhenSibling);
});
