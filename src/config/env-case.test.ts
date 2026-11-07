/* eslint-disable security/detect-non-literal-fs-filename -- test writes only to its own mkdtemp() dir */
import { test } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appEnvSchema, config, registerKomodoConfigSection, resolveKomodoConfig } from "./env.js";

// The framework accepts its fixed options in any case (LOG_LEVEL=INFO, #191). Komodo's own
// options follow the same rule, in the environment and in the config file.
const dir = mkdtempSync(join(tmpdir(), "komodo-mcp-config-case-"));
const configPath = join(dir, "config.toml");
writeFileSync(configPath, ["[tools]", 'confirm_fallback = "ALLOW"', ""].join("\n"));
process.env["MCP_CONFIG_FILE_PATH"] = configPath;

registerKomodoConfigSection();

test("MCP_CONFIRM_FALLBACK accepts any case in the environment", () => {
  assert.equal(appEnvSchema.parse({ MCP_CONFIRM_FALLBACK: "ALLOW" }).MCP_CONFIRM_FALLBACK, "allow");
  assert.equal(appEnvSchema.parse({ MCP_CONFIRM_FALLBACK: "Deny" }).MCP_CONFIRM_FALLBACK, "deny");
  assert.throws(() => appEnvSchema.parse({ MCP_CONFIRM_FALLBACK: "maybe" }));
});

test("[tools] confirm_fallback accepts any case in the config file", () => {
  resolveKomodoConfig();
  assert.equal(config.MCP_CONFIRM_FALLBACK, "allow");
});
