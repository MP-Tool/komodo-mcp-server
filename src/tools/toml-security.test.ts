// Must precede komodo_client's import chain, including inside isolated workers.
import "../utils/polyfills.js";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { configureDynamicResourceRegistry, logger, ToolRegistry } from "mcp-server-framework";
import { createSecretScrubber, Logger } from "mcp-server-framework/logger";
import * as toml from "smol-toml";
import { KomodoClient, configureKomodoConnections, stopKomodoConnections } from "../client.js";
import { config, ToolScopes } from "../config/index.js";
import { resolveScrubOptions } from "../utils/index.js";
import { exportAllResourcesToTomlTool, exportResourcesToTomlTool } from "./toml.js";

type Scenario = "malformed" | "many-keys";

// Both advisory inputs run ONLY inside workers. The parent's timer can terminate
// a worker even if synchronous parse() blocks that worker's event loop forever.
// A generous deadline replaces fragile throughput/elapsed-time ratios on CI.
function runIsolated(scenario: Scenario): Promise<void> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: scenario, stdout: true, stderr: true });
    let passed = false;
    const deadline = setTimeout(() => {
      void worker.terminate().then(() => reject(new Error(`TOML ${scenario} exceeded the 30s safety deadline`)));
    }, 30_000);
    worker.on("message", (message: unknown) => {
      passed = message === "passed";
    });
    // No raw parser exception, document or assertion diff escapes the worker.
    worker.on("error", () => {
      clearTimeout(deadline);
      reject(new Error(`Isolated TOML ${scenario} worker failed`));
    });
    worker.on("exit", (code) => {
      clearTimeout(deadline);
      if (code === 0 && passed) resolve();
      else reject(new Error(`Isolated TOML ${scenario} regression failed`));
    });
    worker.stdout.resume();
    worker.stderr.resume();
  });
}

async function checkMalformedExports(inputs: string[]): Promise<void> {
  config.MCP_SECRET_SCRUB_ENABLED = true;
  const fixture = KomodoClient.connectWithApiKey("https://komodo.invalid", "test-key", "test-secret");
  mock.method(globalThis, "fetch", () => {
    throw new Error("Unexpected network access in TOML security tests");
  });
  mock.method(KomodoClient, "ping", async () => ({ reachable: true }));
  mock.method(KomodoClient, "connectWithApiKey", () => fixture);
  mock.method(fixture, "healthCheck", async () => ({ healthy: true }));
  let document = "";
  mock.method(fixture.client, "read", async () => ({ toml: document }));
  process.env["KOMODO_URL"] = "https://komodo.invalid";
  process.env["KOMODO_API_KEY"] = "test-key";
  process.env["KOMODO_API_SECRET"] = "test-secret";
  await configureKomodoConnections({ anonymousMode: true });

  const registry = configureDynamicResourceRegistry({ scrub: resolveScrubOptions(), cleanupIntervalMs: 0 });
  const register = mock.method(registry, "register");
  const logs = (["warn", "error"] as const).map((level) => mock.method(Logger.prototype, level, () => {}));
  const sdk = new McpServer({ name: "toml-security-test", version: "1.0.0" });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  serverTransport.sessionId = "security-session";
  const tools = ToolRegistry.createIsolated();
  tools.registerFromFactory(exportAllResourcesToTomlTool);
  tools.registerFromFactory(exportResourcesToTomlTool);
  ToolRegistry.bindToSdk(sdk, tools.getTools(), {
    stateless: false,
    logger,
    resultScrubber: createSecretScrubber(resolveScrubOptions()),
    anonymousScopes: [ToolScopes.READ],
  });
  try {
    await sdk.connect(serverTransport);
    await client.connect(clientTransport);
    for (document of inputs) {
      for (const mode of ["inline", "link", "auto"] as const) {
        config.MCP_RESOURCE_RESPONSE_MODE = mode;
        config.MCP_RESOURCE_INLINE_THRESHOLD_BYTES = 1;
        for (const tool of [exportAllResourcesToTomlTool, exportResourcesToTomlTool]) {
          const response = await client.callTool({ name: tool.name, arguments: {} });
          assert.equal(response.isError, true);
          assert.equal(response.structuredContent, undefined);
          assert.match(JSON.stringify(response), /TOML export withheld: structural secret redaction failed/);
          assert.ok(!JSON.stringify(response).includes("advisory-private-credential"));
          assert.ok(!JSON.stringify(response).includes("broken"));
        }
      }
    }
    assert.equal(register.mock.callCount(), 0);
    assert.equal(registry.size, 0);
    for (const log of logs) assert.equal(log.mock.callCount(), 0);
  } finally {
    await client.close();
    await sdk.close();
    registry.clear();
    stopKomodoConnections();
    mock.restoreAll();
  }
}

async function checkScenario(scenario: Scenario): Promise<void> {
  // Resolve from the framework too, so a future nested dependency cannot silently
  // leave its config/MIME scrubber using an untested vulnerable parser instance.
  const frameworkRequire = createRequire(import.meta.resolve("mcp-server-framework"));
  const frameworkToml = (await import(pathToFileURL(frameworkRequire.resolve("smol-toml")).href)) as typeof toml;
  if (scenario === "malformed") {
    // https://github.com/advisories/GHSA-7w5x-hrqm-74c2
    // Exact PoC plus array/inline-table variants with a secret before the fault.
    const prefix = '[[variable]]\nis_secret = true\nvalue = "advisory-private-credential"\n';
    const inputs = ["a=[1 #", `${prefix}broken = [1 # no newline`, `${prefix}broken = { key = 1 # no newline`];
    for (const parser of [toml, frameworkToml]) {
      for (const input of inputs) assert.throws(() => parser.parse(input), parser.TomlError);
    }
    await checkMalformedExports(inputs);
  } else {
    // https://github.com/advisories/GHSA-r4xh-jqrq-34v2
    // Ordinary, valid, dot-free keys formerly rescanned the entire remaining
    // document for each line. No tight machine-dependent timing assertions.
    const count = 512_000;
    const input = Array.from({ length: count }, (_, i) => `k${i} = 1\n`).join("");
    for (const parser of [toml, frameworkToml]) {
      const parsed = parser.parse(input);
      assert.equal(Object.keys(parsed).length, count);
      assert.equal(parsed["k0"], 1);
      assert.equal(parsed[`k${count - 1}`], 1);
    }
  }
}

if (isMainThread) {
  test("GHSA-7w5x-hrqm-74c2: EOF comments fail safely without exporting or logging secrets", () =>
    runIsolated("malformed"));
  test("GHSA-r4xh-jqrq-34v2: many ordinary dot-free keys parse within an isolated safety deadline", () =>
    runIsolated("many-keys"));
} else {
  try {
    await checkScenario(workerData as Scenario);
    parentPort?.postMessage("passed");
  } catch {
    // Deliberately discard parser/assertion details: they can contain credentials.
    parentPort?.postMessage("failed");
    process.exitCode = 1;
  }
}
