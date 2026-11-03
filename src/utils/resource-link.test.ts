import { afterEach, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { configureDynamicResourceRegistry, getDynamicResourceRegistry } from "mcp-server-framework";
import { config } from "../config/index.js";
import { tryRegisterResource, type RegisterResourceOptions } from "./resource-link.js";
import { buildInfoResult } from "./response-formatter.js";
import { resolveScrubOptions } from "./redact.js";

const originalConfig = { ...config };
const options: RegisterResourceOptions = {
  ctx: { sessionId: "session-a" },
  category: "info",
  name: "stack (info)",
  mimeType: "application/json",
  content: '{"name":"stack"}',
  ttlMs: 900000,
  description: "Full stack resource",
};

beforeEach(() => {
  Object.assign(config, originalConfig, {
    MCP_RESOURCE_RESPONSE_MODE: "link",
    MCP_RESOURCE_INLINE_THRESHOLD_BYTES: 16384,
    MCP_RESOURCE_TTL_INFO: 900000,
    MCP_RESOURCE_TTL_LOGS: 120000,
    MCP_SECRET_SCRUB_ENABLED: true,
    MCP_SECRET_SCRUB_KEYS: [],
    MCP_SECRET_SCRUB_ALLOW_KEYS: [],
  });
  configureDynamicResourceRegistry({ scrub: resolveScrubOptions(), cleanupIntervalMs: 0 });
});
afterEach(() => {
  getDynamicResourceRegistry().clear();
  Object.assign(config, originalConfig);
});

test("default link mode offloads even tiny payloads and preserves link metadata", () => {
  const link = tryRegisterResource(options);
  assert.ok(link);
  assert.match(link.uri, /^ephemeral:\/\/info\/[a-f0-9]{32}$/);
  assert.deepEqual(link, {
    uri: link.uri,
    name: options.name,
    mimeType: options.mimeType,
    description: options.description,
  });
  const stored = getDynamicResourceRegistry().read(link.uri, "session-a");
  assert.equal(stored.mimeType, options.mimeType);
  assert.deepEqual(JSON.parse(stored.content as string), JSON.parse(options.content as string));
});

test("auto mode inlines small payloads without registering a resource", () => {
  config.MCP_RESOURCE_RESPONSE_MODE = "auto";
  assert.equal(tryRegisterResource(options), null);
  assert.equal(getDynamicResourceRegistry().size, 0);
});

test("auto mode offloads payloads larger than the configured threshold", () => {
  config.MCP_RESOURCE_RESPONSE_MODE = "auto";
  const content = "x".repeat(config.MCP_RESOURCE_INLINE_THRESHOLD_BYTES + 1);
  const link = tryRegisterResource({ ...options, content, mimeType: "text/plain" });
  assert.ok(link);
  assert.equal(getDynamicResourceRegistry().read(link.uri, "session-a").content, content);
});

test("auto mode uses an inclusive exact byte threshold", () => {
  config.MCP_RESOURCE_RESPONSE_MODE = "auto";
  for (const delta of [-1, 0, 1]) {
    const link = tryRegisterResource({
      ...options,
      mimeType: "text/plain",
      content: "x".repeat(config.MCP_RESOURCE_INLINE_THRESHOLD_BYTES + delta),
    });
    assert.equal(link !== null, delta > 0, `threshold delta: ${delta}`);
  }
});

test("auto mode measures UTF-8 multibyte characters rather than UTF-16 code units", () => {
  config.MCP_RESOURCE_RESPONSE_MODE = "auto";
  config.MCP_RESOURCE_INLINE_THRESHOLD_BYTES = 8;
  assert.equal(tryRegisterResource({ ...options, content: "é漢€", mimeType: "text/plain" }), null); // 2+3+3 bytes
  const content = "é漢😀"; // 2+3+4 bytes, but only 4 JS code units
  assert.ok(content.length < 8);
  assert.ok(tryRegisterResource({ ...options, content, mimeType: "text/plain" }));
});

test("auto mode measures a Uint8Array view, not its entire backing buffer", () => {
  config.MCP_RESOURCE_RESPONSE_MODE = "auto";
  config.MCP_RESOURCE_INLINE_THRESHOLD_BYTES = 8;
  const buffer = new Uint8Array(100);
  assert.equal(tryRegisterResource({ ...options, content: buffer.subarray(0, 8) }), null);
  assert.ok(tryRegisterResource({ ...options, content: buffer.subarray(0, 9) }));
});

test("inline mode always skips offloading, including large payloads", () => {
  config.MCP_RESOURCE_RESPONSE_MODE = "inline";
  assert.equal(tryRegisterResource(options), null);
  assert.equal(tryRegisterResource({ ...options, content: "x".repeat(32768) }), null);
  assert.equal(getDynamicResourceRegistry().size, 0);
});

test("lazy resource factories are not evaluated when delivery is already inline", (t) => {
  const content = t.mock.fn(() => {
    throw new Error("discarded resource serialization executed");
  });
  for (const mode of ["link", "inline", "auto"] as const) {
    config.MCP_RESOURCE_RESPONSE_MODE = mode;
    for (const category of ["info", "logs"] as const) {
      assert.equal(tryRegisterResource({ ...options, category, content, inlineFull: true }), null);
      assert.equal(tryRegisterResource({ ...options, category, content, ctx: {} }), null);
      if (mode === "inline") assert.equal(tryRegisterResource({ ...options, category, content }), null);
    }
  }
  config.MCP_RESOURCE_RESPONSE_MODE = "auto";
  assert.equal(
    tryRegisterResource({ ...options, content, originalBytes: config.MCP_RESOURCE_INLINE_THRESHOLD_BYTES }),
    null,
  );
  assert.equal(content.mock.callCount(), 0);
});

test("large info inline results skip their unused JSON resource copy", (t) => {
  const toJSON = t.mock.fn(() => {
    throw new Error("unused JSON resource copy");
  });
  const result = { name: "large-info", data: "x".repeat(131072), toJSON };
  for (const scenario of [
    { mode: "inline", ctx: options.ctx },
    { mode: "link", ctx: options.ctx, inlineFull: true },
    { mode: "auto", ctx: options.ctx, inlineFull: true },
    { mode: "link", ctx: {} },
    { mode: "auto", ctx: {} },
  ] as const) {
    config.MCP_RESOURCE_RESPONSE_MODE = scenario.mode;
    const response = buildInfoResult({
      result,
      summary: { name: result.name },
      register: { ...scenario, name: result.name, ttlMs: options.ttlMs, description: "Large info" },
      // The renderer's own representation is separate from the unused resource copy.
      render: () => "Info returned inline",
    });
    assert.equal(response.structuredContent?.["info"], result);
    assert.equal(
      response.content.some((block) => block.type === "resource_link"),
      false,
    );
  }
  assert.equal(toJSON.mock.callCount(), 0);
  assert.equal(getDynamicResourceRegistry().size, 0);
});

test("link and auto evaluate lazy content exactly once when sizing or offloading needs it", (t) => {
  for (const mode of ["link", "auto"] as const) {
    config.MCP_RESOURCE_RESPONSE_MODE = mode;
    for (const size of [8, 32768]) {
      const content = t.mock.fn(() => "x".repeat(size));
      const link = tryRegisterResource({ ...options, mimeType: "text/plain", content });
      assert.equal(content.mock.callCount(), 1);
      assert.equal(link !== null, mode === "link" || size > config.MCP_RESOURCE_INLINE_THRESHOLD_BYTES);
      if (link) assert.equal(getDynamicResourceRegistry().read(link.uri, "session-a").content, "x".repeat(size));
    }
  }
});

test("lazy content preserves complete inline fallback when registration fails", (t) => {
  t.mock.method(getDynamicResourceRegistry(), "register", () => {
    throw new Error("registry unavailable");
  });
  for (const mode of ["link", "auto"] as const) {
    config.MCP_RESOURCE_RESPONSE_MODE = mode;
    const content = t.mock.fn(() => "x".repeat(32768));
    assert.equal(tryRegisterResource({ ...options, content }), null);
    assert.equal(content.mock.callCount(), 1);
  }
});

test("lazy preparation failures remain tool errors instead of registry fallbacks", () => {
  const content = () => {
    throw new Error("serialization failed");
  };
  for (const mode of ["link", "auto"] as const) {
    config.MCP_RESOURCE_RESPONSE_MODE = mode;
    assert.throws(() => tryRegisterResource({ ...options, content }), /serialization failed/);
  }
});

test("inline_full overrides every mode even for large payloads", () => {
  for (const mode of ["link", "inline", "auto"] as const) {
    config.MCP_RESOURCE_RESPONSE_MODE = mode;
    assert.equal(tryRegisterResource({ ...options, content: "x".repeat(32768), inlineFull: true }), null);
  }
  assert.equal(getDynamicResourceRegistry().size, 0);
});

test("inline_full false does not override the configured policy", () => {
  for (const mode of ["link", "inline", "auto"] as const) {
    config.MCP_RESOURCE_RESPONSE_MODE = mode;
    assert.equal(tryRegisterResource({ ...options, inlineFull: false }) !== null, mode === "link");
  }
});

test("missing and empty sessions preserve inline fallback in every mode", () => {
  for (const mode of ["link", "inline", "auto"] as const) {
    config.MCP_RESOURCE_RESPONSE_MODE = mode;
    for (const ctx of [{}, { sessionId: "" }]) {
      assert.equal(tryRegisterResource({ ...options, ctx, content: "x".repeat(32768) }), null);
    }
  }
  assert.equal(getDynamicResourceRegistry().size, 0);
});

test("registration failure falls back to the complete inline output shape", (t) => {
  t.mock.method(getDynamicResourceRegistry(), "register", () => {
    throw new Error("registry unavailable");
  });
  const result = { name: "stack", config: { file_contents: "services: {}" } };
  for (const mode of ["link", "auto"] as const) {
    config.MCP_RESOURCE_RESPONSE_MODE = mode;
    config.MCP_RESOURCE_INLINE_THRESHOLD_BYTES = 1;
    const response = buildInfoResult({
      result,
      summary: { name: "stack" },
      register: { ...options, ctx: options.ctx, description: "Full stack resource" },
      render: (payload) => JSON.stringify(payload),
    });
    assert.deepEqual(response.structuredContent, { summary: { name: "stack" }, info: result });
    assert.equal(
      response.content.some((block) => block.type === "resource_link"),
      false,
    );
  }
});

test("auto measures the original serialized payload before redaction can shrink it", () => {
  config.MCP_RESOURCE_RESPONSE_MODE = "auto";
  config.MCP_RESOURCE_INLINE_THRESHOLD_BYTES = 128;
  const link = tryRegisterResource({ ...options, content: JSON.stringify({ password: "s".repeat(512) }) });
  assert.ok(link);
  const stored = getDynamicResourceRegistry().read(link.uri, "session-a").content;
  assert.equal(typeof stored, "string");
  assert.ok(Buffer.byteLength(stored, "utf8") < 128);
});

test("pre-scrubbed TOML still selects delivery using the original byte count", () => {
  config.MCP_RESOURCE_RESPONSE_MODE = "auto";
  config.MCP_RESOURCE_INLINE_THRESHOLD_BYTES = 128;
  const link = tryRegisterResource({
    ...options,
    content: 'name = "safe"\n',
    mimeType: "application/toml",
    originalBytes: 512,
  });
  assert.ok(link);
  assert.equal(getDynamicResourceRegistry().read(link.uri, "session-a").content, 'name = "safe"\n');
});

test("auto preserves per-call TTLs, session isolation, and registry entry bounds", (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1000 });
  config.MCP_RESOURCE_RESPONSE_MODE = "auto";
  config.MCP_RESOURCE_INLINE_THRESHOLD_BYTES = 1;
  const registry = configureDynamicResourceRegistry({
    maxEntries: 2,
    scrub: resolveScrubOptions(),
    cleanupIntervalMs: 0,
  });
  const info = tryRegisterResource({ ...options, ttlMs: config.MCP_RESOURCE_TTL_INFO });
  const logs = tryRegisterResource({ ...options, category: "logs", ttlMs: config.MCP_RESOURCE_TTL_LOGS });
  assert.ok(info);
  assert.ok(logs);
  assert.throws(() => registry.read(info.uri, "session-b"), /Cross-session/);
  t.mock.timers.tick(config.MCP_RESOURCE_TTL_LOGS);
  assert.throws(() => registry.read(logs.uri, "session-a"), /not found/i);
  assert.ok(registry.read(info.uri, "session-a"));
  const second = tryRegisterResource(options);
  const third = tryRegisterResource(options);
  assert.ok(second);
  assert.ok(third);
  assert.equal(registry.size, 2);
  assert.throws(() => registry.read(info.uri, "session-a"), /not found/i);
  t.mock.timers.tick(options.ttlMs);
  assert.throws(() => registry.read(second.uri, "session-a"), /not found/i);
});
