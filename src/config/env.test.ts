/* eslint-disable security/detect-non-literal-fs-filename -- test writes only to its own mkdtemp() dir */
import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appEnvSchema, config, registerKomodoConfigSection, resolveKomodoConfig } from "./env.js";

// Point the framework config loader at a temp file. env.js's import-time parse is env-only;
// the file is read only when resolveKomodoConfig() → getFrameworkConfig() runs (in the tests),
// so setting this before that call is sufficient. node --test runs each test file in its own
// process, so the config singleton here is isolated from other suites.
const dir = mkdtempSync(join(tmpdir(), "komodo-mcp-config-"));
const configPath = join(dir, "config.toml");
writeFileSync(
  configPath,
  [
    "[tools]",
    "confirm_destructive = false",
    'allowed_categories = ["server", "stack"]',
    "",
    "[redaction]",
    "enabled = false",
    "",
    "[resources]",
    "max_entries = 42",
    'response_mode = "auto"',
    "inline_threshold_bytes = 2048",
    "",
  ].join("\n"),
);
process.env["MCP_CONFIG_FILE_PATH"] = configPath;

registerKomodoConfigSection();

// Each test starts without resource-delivery env overrides.
beforeEach(() => {
  delete process.env["MCP_RESOURCE_RESPONSE_MODE"];
  delete process.env["MCP_RESOURCE_INLINE_THRESHOLD_BYTES"];
});
after(() => rmSync(dir, { recursive: true, force: true }));

test("config-file values are resolved (file > default), one key per new section", () => {
  resolveKomodoConfig();
  assert.equal(config.MCP_CONFIRM_DESTRUCTIVE, false); // [tools] overrides default(true)
  assert.deepEqual(config.MCP_TOOLS_ALLOWED_CATEGORIES, ["server", "stack"]); // [tools]
  assert.equal(config.MCP_SECRET_SCRUB_ENABLED, false); // [redaction] overrides default(true)
  assert.equal(config.MCP_RESOURCE_MAX_ENTRIES, 42); // [resources] overrides default(1000)
  assert.equal(config.MCP_RESOURCE_RESPONSE_MODE, "auto");
  assert.equal(config.MCP_RESOURCE_INLINE_THRESHOLD_BYTES, 2048);
});

test("environment variables override config-file values (env > file)", () => {
  process.env["MCP_RESOURCE_MAX_ENTRIES"] = "99";
  process.env["MCP_CONFIRM_DESTRUCTIVE"] = "true";
  process.env["MCP_RESOURCE_RESPONSE_MODE"] = "inline";
  process.env["MCP_RESOURCE_INLINE_THRESHOLD_BYTES"] = "4096";
  resolveKomodoConfig();
  assert.equal(config.MCP_RESOURCE_MAX_ENTRIES, 99); // env wins over file(42)
  assert.equal(config.MCP_CONFIRM_DESTRUCTIVE, true); // env wins over file(false)
  assert.equal(config.MCP_RESOURCE_RESPONSE_MODE, "inline");
  assert.equal(config.MCP_RESOURCE_INLINE_THRESHOLD_BYTES, 4096);
  assert.deepEqual(config.MCP_TOOLS_ALLOWED_CATEGORIES, ["server", "stack"]); // no env → file still applies
});

test("resource delivery defaults preserve v1.5.0 link behavior", () => {
  const defaults = appEnvSchema.parse({});
  assert.equal(defaults.MCP_RESOURCE_RESPONSE_MODE, "link");
  assert.equal(defaults.MCP_RESOURCE_INLINE_THRESHOLD_BYTES, 16384);
});

test("all resource delivery modes are accepted", () => {
  for (const mode of ["link", "inline", "auto"]) {
    assert.equal(appEnvSchema.parse({ MCP_RESOURCE_RESPONSE_MODE: mode }).MCP_RESOURCE_RESPONSE_MODE, mode);
  }
});

test("invalid resource delivery configuration reports the offending variable", () => {
  for (const value of ["", "AUTO", "unknown", " link "]) {
    const parsed = appEnvSchema.safeParse({ MCP_RESOURCE_RESPONSE_MODE: value });
    assert.equal(parsed.success, false);
    assert.deepEqual(parsed.error.issues[0]?.path, ["MCP_RESOURCE_RESPONSE_MODE"]);
  }
  for (const value of ["", " ", "0", "-1", "1.5", "NaN", "Infinity", "16kb", "9007199254740992"]) {
    const parsed = appEnvSchema.safeParse({ MCP_RESOURCE_INLINE_THRESHOLD_BYTES: value });
    assert.equal(parsed.success, false, `accepted invalid threshold ${JSON.stringify(value)}`);
    assert.deepEqual(parsed.error.issues[0]?.path, ["MCP_RESOURCE_INLINE_THRESHOLD_BYTES"]);
  }
  assert.equal(appEnvSchema.parse({ MCP_RESOURCE_INLINE_THRESHOLD_BYTES: "1" }).MCP_RESOURCE_INLINE_THRESHOLD_BYTES, 1);
});

test("invalid delivery settings fail config resolution instead of silently using defaults", () => {
  process.env["MCP_RESOURCE_RESPONSE_MODE"] = "broken";
  assert.throws(resolveKomodoConfig, /MCP_RESOURCE_RESPONSE_MODE/);
  delete process.env["MCP_RESOURCE_RESPONSE_MODE"];
  process.env["MCP_RESOURCE_INLINE_THRESHOLD_BYTES"] = "-1";
  assert.throws(resolveKomodoConfig, /MCP_RESOURCE_INLINE_THRESHOLD_BYTES/);
});

test("invalid resource delivery settings in a config file fail startup with the offending key", () => {
  // Config files are cached per process, so each case needs a fresh loader.
  const moduleUrl = new URL("./env.js", import.meta.url).href;
  const script = `const config = await import(${JSON.stringify(moduleUrl)}); config.registerKomodoConfigSection(); config.resolveKomodoConfig();`;
  for (const [setting, key] of [
    ['response_mode = "invalid"', "response_mode"],
    ["inline_threshold_bytes = 0", "inline_threshold_bytes"],
    ["inline_threshold_bytes = 1.5", "inline_threshold_bytes"],
    ['inline_threshold_bytes = "16384"', "inline_threshold_bytes"],
  ] as const) {
    const invalidPath = join(dir, "invalid.toml");
    writeFileSync(invalidPath, `[resources]\n${setting}\n`);
    const env: NodeJS.ProcessEnv = { ...process.env, MCP_CONFIG_FILE_PATH: invalidPath };
    delete env["MCP_RESOURCE_RESPONSE_MODE"];
    delete env["MCP_RESOURCE_INLINE_THRESHOLD_BYTES"];
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
      env,
      encoding: "utf8",
      timeout: 10000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 1, `${setting}: ${result.stderr}`);
    assert.ok(result.stderr.includes(key), `${setting}: missing validation key in ${result.stderr}`);
  }
});
