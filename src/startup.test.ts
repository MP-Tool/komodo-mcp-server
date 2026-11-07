/* eslint-disable security/detect-non-literal-fs-filename -- test writes only to its own mkdtemp() dir */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// A server that cannot start because of its settings has to say so in a few readable lines on
// stderr and exit with 1. The person reading that is often looking at an MCP client's log (#191),
// where a stack trace or a raw validation dump hides the one line that matters.

const entry = join(dirname(fileURLToPath(import.meta.url)), "index.js");
const dir = mkdtempSync(join(tmpdir(), "komodo-mcp-startup-"));

function start(env: Record<string, string>): { status: number | null; stderr: string } {
  const result = spawnSync(process.execPath, [entry], {
    env: { PATH: process.env["PATH"] ?? "", MCP_TRANSPORT: "stdio", ...env },
    input: "",
    encoding: "utf8",
    timeout: 20_000,
  });
  return { status: result.status, stderr: result.stderr };
}

function assertReadable(stderr: string): void {
  assert.match(stderr, /Komodo MCP Server could not start/);
  assert.doesNotMatch(stderr, /ZodError|"code":|^\s+at /m, stderr);
  assert.doesNotMatch(stderr, /file:\/\/|errorId/, stderr);
}

test("an invalid Komodo setting in the environment stops the start with a readable message", () => {
  const { status, stderr } = start({ MCP_CONFIRM_FALLBACK: "maybe" });
  assert.equal(status, 1, stderr);
  assert.match(stderr, /MCP_CONFIRM_FALLBACK/);
  assertReadable(stderr);
});

test("an invalid framework setting in the environment stops the start with a readable message", () => {
  const { status, stderr } = start({ MCP_PORT: "not-a-port" });
  assert.equal(status, 1, stderr);
  assert.match(stderr, /MCP_PORT/);
  assertReadable(stderr);
});

test("an invalid config file set via MCP_CONFIG_FILE_PATH stops the start with a readable message", () => {
  const file = join(dir, "config.toml");
  writeFileSync(file, '[logging]\nbogus = 1\n\n[tools]\nconfirm_fallback = "maybe"\n');
  const { status, stderr } = start({ MCP_CONFIG_FILE_PATH: file });
  assert.equal(status, 1, stderr);
  assert.match(stderr, /bogus/);
  assert.match(stderr, /confirm_fallback/);
  assert.ok(stderr.includes(file), stderr);
  assertReadable(stderr);
});
