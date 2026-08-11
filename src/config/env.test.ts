/* eslint-disable security/detect-non-literal-fs-filename -- test writes only to its own mkdtemp() dir */
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config, registerKomodoConfigSection, resolveKomodoConfig } from "./env.js";

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
    "",
  ].join("\n"),
);
process.env["MCP_CONFIG_FILE_PATH"] = configPath;

registerKomodoConfigSection();

test("config-file values are resolved (file > default), one key per new section", () => {
  resolveKomodoConfig();
  assert.equal(config.MCP_CONFIRM_DESTRUCTIVE, false); // [tools] overrides default(true)
  assert.deepEqual(config.MCP_TOOLS_ALLOWED_CATEGORIES, ["server", "stack"]); // [tools]
  assert.equal(config.MCP_SECRET_SCRUB_ENABLED, false); // [redaction] overrides default(true)
  assert.equal(config.MCP_RESOURCE_MAX_ENTRIES, 42); // [resources] overrides default(1000)
});

test("environment variables override config-file values (env > file)", () => {
  process.env["MCP_RESOURCE_MAX_ENTRIES"] = "99";
  process.env["MCP_CONFIRM_DESTRUCTIVE"] = "true";
  resolveKomodoConfig();
  assert.equal(config.MCP_RESOURCE_MAX_ENTRIES, 99); // env wins over file(42)
  assert.equal(config.MCP_CONFIRM_DESTRUCTIVE, true); // env wins over file(false)
  assert.deepEqual(config.MCP_TOOLS_ALLOWED_CATEGORIES, ["server", "stack"]); // no env → file still applies
});
