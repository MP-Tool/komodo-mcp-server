import { test } from "node:test";
import assert from "node:assert/strict";
import { buildApplyResult, buildDeleteResult, buildInfoResult } from "./response-formatter.js";

// The builders deliberately do NOT scrub: secret redaction happens centrally at
// the framework's tool-result boundary (and on offloaded-resource registration),
// wired in src/index.ts. These tests pin that contract plus the payload shapes.

test("buildApplyResult passes the resource through verbatim (scrubbing is the boundary's job)", () => {
  const built = buildApplyResult("update", "stack", "s", { config: { environment: "API_KEY=abc123" } });
  assert.equal((built.payload.resource as any).config.environment, "API_KEY=abc123");
  assert.equal(built.payload.action, "update");
  assert.equal(built.payload.resource_type, "stack");
  assert.match(built.text, /API_KEY=abc123/);
});

test("buildDeleteResult passes the resource through verbatim and shapes the payload", () => {
  const built = buildDeleteResult("build", "b", { config: { webhook_secret: "shh-987" } });
  assert.equal((built.payload.resource as any).config.webhook_secret, "shh-987");
  assert.equal(built.payload.action, "remove");
  assert.equal(built.payload.resource_id, "b");
});

test("buildInfoResult inlines the raw result when inlineFull is set", () => {
  const res = buildInfoResult({
    result: { config: { environment: "TOKEN=leakme" } },
    summary: { id: "d", name: "d" },
    register: { ctx: {}, name: "d (info)", ttlMs: 0, inlineFull: true, description: "d" },
    render: () => "rendered",
  });
  const payload = res.structuredContent as { summary: { id: string }; info?: unknown };
  assert.equal(payload.summary.id, "d");
  assert.ok(payload.info, "inlineFull result must carry the info payload");
  assert.equal((res.content[0] as { text: string }).text, "rendered");
});

test("buildInfoResult falls back to inlining without a sessionId (no resource link)", () => {
  const res = buildInfoResult({
    result: { config: { branch: "main" } },
    summary: { id: "x" },
    register: { ctx: {}, name: "x (info)", ttlMs: 0, description: "x" },
    render: (p) => ("info" in p ? "inline" : "link"),
  });
  const payload = res.structuredContent as { info?: unknown; resourceLink?: unknown };
  assert.ok(payload.info);
  assert.equal(payload.resourceLink, undefined);
  assert.equal((res.content[0] as { text: string }).text, "inline");
});
