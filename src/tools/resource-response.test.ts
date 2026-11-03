// Must precede komodo_client's import chain.
import "../utils/polyfills.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  configureDynamicResourceRegistry,
  defineDynamicResourceTemplate,
  logger,
  ResourceRegistry,
  ToolRegistry,
} from "mcp-server-framework";
import { createSecretScrubber, SecretScrubber, Logger } from "mcp-server-framework/logger";
import { parse as parseToml } from "smol-toml";
import { config, ToolScopes } from "../config/index.js";
import { KomodoClient, configureKomodoConnections, stopKomodoConnections } from "../client.js";
import { resolveScrubOptions } from "../utils/index.js";
import { getStackInfoTool } from "./stack.js";
import { getBuildLogsTool } from "./build.js";
import { inspectContainerTool, getContainerLogsTool, searchContainerLogsTool } from "./container.js";
import { exportAllResourcesToTomlTool, exportResourcesToTomlTool } from "./toml.js";

// These tests exercise real tool handlers, SDK output-schema validation, the
// framework result scrubber, scrub-on-register, and MCP resources/read. Only
// Komodo's downstream API is mocked; no network or production access is used.
test("adaptive delivery preserves complete, redacted tool results across the MCP boundary", async (t) => {
  const originalConfig = { ...config };
  const originalEnv = { ...process.env };
  // Komodo's explicit test setting overrides an inherited MCP_SCRUB_ENABLED=false.
  config.MCP_SECRET_SCRUB_ENABLED = true;
  config.MCP_SECRET_SCRUB_KEYS = [];
  config.MCP_SECRET_SCRUB_ALLOW_KEYS = [];
  const registry = configureDynamicResourceRegistry({ scrub: resolveScrubOptions(), cleanupIntervalMs: 0 });
  const resultScrubber = createSecretScrubber(resolveScrubOptions());
  assert.ok(resultScrubber);
  let padding = "";
  let exportFixture: { toml: unknown } | undefined;
  const secrets = [
    "stack-credential-739",
    "expanded-deploy-849",
    "inspect-credential-527",
    "log-credential-293",
    "variable-credential-643",
    "server-credential-897",
    "https://ntfy.sh/private-endpoint-427",
  ];
  const fixture = KomodoClient.connectWithApiKey("https://komodo.invalid", "test-key", "test-secret");
  t.mock.method(globalThis, "fetch", () => {
    throw new Error("Unexpected network access in resource-response tests");
  });
  t.mock.method(KomodoClient, "ping", async () => ({ reachable: true }));
  t.mock.method(KomodoClient, "connectWithApiKey", () => fixture);
  t.mock.method(fixture, "healthCheck", async () => ({ healthy: true }));
  t.mock.method(fixture.client, "read", async (type: string) => {
    switch (type) {
      case "GetStack":
        return {
          name: "test-stack",
          config: { webhook_secret: secrets[0], note: padding },
          info: { state: "running", deployed_config: secrets[1] },
        };
      case "InspectDockerContainer":
        return {
          State: { Status: "running" },
          Config: { Image: "test:latest", Env: [`API_TOKEN=${secrets[2]}`, "HOST=db.local"] },
          padding,
        };
      case "GetContainerLog":
        return { stdout: `match API_TOKEN=${secrets[3]}\nmatch ${padding}\ncomplete-log-end`, stderr: "" };
      case "GetUpdate":
        return {
          target: { type: "Build", id: "b" },
          success: true,
          status: "Complete",
          logs: [
            {
              stage: "build",
              command: "docker build .",
              success: true,
              stdout: `API_TOKEN=${secrets[3]}\n${padding}`,
              stderr: "",
              start_ts: 1,
              end_ts: 2,
            },
          ],
        };
      case "ExportAllResourcesToToml":
      case "ExportResourcesToToml":
        if (exportFixture) return exportFixture;
        return {
          toml:
            `[[variable]]\nname = "v"\nis_secret = true\nvalue = "${secrets[4]}"\n` +
            `[[server]]\nname = "s"\n[server.config]\npasskey = "${secrets[5]}"\n` +
            `[[alerter]]\nname = "a"\n[alerter.config.endpoint]\ntype = "Ntfy"\n[alerter.config.endpoint.params]\nurl = "${secrets[6]}"\nnote = "${padding}"\nmarker = "complete-export-end"\n`,
        };
      default:
        throw new Error(`Unexpected Komodo API call: ${type}`);
    }
  });
  process.env["KOMODO_URL"] = "https://komodo.invalid";
  process.env["KOMODO_API_KEY"] = "test-key";
  process.env["KOMODO_API_SECRET"] = "test-secret";

  const sdk = new McpServer({ name: "resource-response-test", version: "1.0.0" });
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  serverTransport.sessionId = "session-a";
  t.after(async () => {
    await client.close();
    await sdk.close();
    stopKomodoConnections();
    registry.clear();
    Object.assign(config, originalConfig);
    process.env = originalEnv;
  });
  await configureKomodoConnections({ anonymousMode: true });
  const toolRegistry = ToolRegistry.createIsolated();
  toolRegistry.registerFromFactory(getStackInfoTool);
  toolRegistry.registerFromFactory(inspectContainerTool);
  toolRegistry.registerFromFactory(getContainerLogsTool);
  toolRegistry.registerFromFactory(searchContainerLogsTool);
  toolRegistry.registerFromFactory(getBuildLogsTool);
  toolRegistry.registerFromFactory(exportAllResourcesToTomlTool);
  toolRegistry.registerFromFactory(exportResourcesToTomlTool);
  const tools = toolRegistry.getTools();
  ToolRegistry.bindToSdk(sdk, tools, { stateless: false, logger, resultScrubber, anonymousScopes: [ToolScopes.READ] });
  const resourceRegistry = ResourceRegistry.createIsolated();
  resourceRegistry.registerTemplateFromFactory(defineDynamicResourceTemplate({ registry }));
  ResourceRegistry.bindToSdk(sdk, [], resourceRegistry.getTemplates(), { logger, resultScrubber });
  await sdk.connect(serverTransport);
  await client.connect(clientTransport);

  const advertised = await client.listTools();
  for (const tool of [exportAllResourcesToTomlTool, exportResourcesToTomlTool]) {
    const description = advertised.tools.find((entry) => entry.name === tool.name)?.description ?? "";
    assert.match(description, /When secret scrubbing is enabled/);
    assert.match(description, /When scrubbing is explicitly disabled.*unmasked credentials/);
  }

  for (const scenario of [
    { mode: "link", large: false, link: true },
    { mode: "inline", large: false, link: false },
    { mode: "inline", large: true, link: false },
    { mode: "auto", large: false, link: false },
    { mode: "auto", large: true, link: true },
    { mode: "link", large: true, inlineFull: true, link: false },
    { mode: "auto", large: true, inlineFull: true, link: false },
    { mode: "auto", large: true, missingSession: true, link: false },
    { mode: "auto", large: true, registrationFailure: true, link: false },
    { mode: "link", large: true, registrationFailure: true, link: false },
  ] as const) {
    await t.test(JSON.stringify(scenario), async (st) => {
      registry.clear();
      config.MCP_RESOURCE_RESPONSE_MODE = scenario.mode;
      config.MCP_RESOURCE_INLINE_THRESHOLD_BYTES = 16384;
      padding = scenario.large ? "x".repeat(20000) : "benign-data-é漢😀";
      if ("missingSession" in scenario) delete serverTransport.sessionId;
      else serverTransport.sessionId = "session-a";
      if ("registrationFailure" in scenario) {
        st.mock.method(registry, "register", () => {
          throw new Error("registry unavailable");
        });
      }
      for (const tool of tools) {
        const args =
          tool.name === getStackInfoTool.name
            ? { stack: "test-stack" }
            : tool.name === getBuildLogsTool.name
              ? { update_id: "u" }
              : tool.name === searchContainerLogsTool.name
                ? { server: "s", container: "c", query: "match" }
                : tool.name === inspectContainerTool.name || tool.name === getContainerLogsTool.name
                  ? { server: "s", container: "c" }
                  : {};
        const response = await client.callTool({
          name: tool.name,
          arguments: { ...args, ...("inlineFull" in scenario ? { inline_full: true } : {}) },
        });
        assert.notEqual(response.isError, true, JSON.stringify(response));
        const payload = response.structuredContent as Record<string, unknown> | undefined;
        assert.ok(payload);
        const blocks = response.content as { type: string; uri?: string }[];
        assert.equal(
          blocks.some((block) => block.type === "resource_link"),
          scenario.link,
          tool.name,
        );
        let full: unknown;
        if (scenario.link) {
          const link = payload["resourceLink"] as { uri: string };
          assert.ok(link.uri);
          assert.equal(blocks.find((block) => block.type === "resource_link")?.uri, link.uri);
          const resource = await client.readResource({ uri: link.uri });
          for (const secret of secrets)
            assert.ok(!JSON.stringify(resource).includes(secret), `resource leaked ${secret}`);
          const content = resource.contents[0];
          assert.ok(content && "text" in content);
          full =
            tool.name === getStackInfoTool.name || tool.name === inspectContainerTool.name
              ? JSON.parse(content.text)
              : content.text;
          assert.throws(() => registry.read(link.uri, "other-session"), /Cross-session/);
        } else {
          assert.equal(payload["resourceLink"], undefined);
          full =
            payload["info"] ??
            payload["inspect"] ??
            payload["stdout"] ??
            payload["toml"] ??
            payload["matches"] ??
            payload["logs"];
        }
        for (const secret of secrets)
          assert.ok(!JSON.stringify(response).includes(secret), `tool result leaked ${secret}`);
        assert.ok(JSON.stringify(full).includes(padding), `${tool.name} lost full payload data`);
        if (tool.name === getStackInfoTool.name) assert.ok(!JSON.stringify(full).includes("deployed_config"));
        if (tool.name === exportAllResourcesToTomlTool.name || tool.name === exportResourcesToTomlTool.name) {
          assert.equal((payload["summary"] as { secrets_masked: boolean }).secrets_masked, true);
          assert.equal(typeof full, "string");
          assert.equal((payload["summary"] as { bytes: number }).bytes, Buffer.byteLength(full as string, "utf8"));
          const parsed = parseToml(full as string);
          assert.equal((parsed["variable"] as { is_secret: boolean }[])[0]?.is_secret, true);
          if (!scenario.link && scenario.large) {
            const text = JSON.stringify(response.content);
            assert.ok(!text.includes(padding), "large inline TOML should not be duplicated in rendered text");
            assert.ok(text.length < 5000, "rendered TOML preview must stay bounded");
            assert.match(text, /complete export in structuredContent.toml/);
          }
        }
      }
      if (!scenario.link) assert.equal(registry.size, 0, "inline delivery must not retain resource copies");
    });
  }

  await t.test("large inline log handlers never concatenate an unused resource copy", async (st) => {
    config.MCP_RESOURCE_RESPONSE_MODE = "inline";
    padding = "x".repeat(131072);
    // Node 22's mock.method rejects arrays, including Array.prototype. Restore
    // this narrowly observed method even if the sequential subtest fails.
    const originalJoin = Array.prototype.join;
    st.after(() => {
      Array.prototype.join = originalJoin;
    });
    let resourceJoins = 0;
    let searchPreviewJoins = 0;
    Array.prototype.join = function (this: unknown[], separator?: string) {
      const first = this[0];
      if (typeof first === "string" && (first.startsWith("=== stdout ===\n") || first.startsWith("=== build ✅ ==="))) {
        resourceJoins++;
        throw new Error("unused resource log concatenation");
      }
      // Search logs render the same line format: one join is needed for the
      // displayed preview; a second would reveal an unused resource copy.
      if (typeof first === "string" && first.startsWith("[stdout] match")) searchPreviewJoins++;
      return originalJoin.call(this, separator);
    };
    for (const tool of [getContainerLogsTool, searchContainerLogsTool, getBuildLogsTool]) {
      const response = await client.callTool({
        name: tool.name,
        arguments:
          tool.name === getBuildLogsTool.name ? { update_id: "u" } : { server: "s", container: "c", query: "match" },
      });
      assert.notEqual(response.isError, true);
      assert.ok(JSON.stringify(response.structuredContent).includes(padding), "complete large logs must stay inline");
      for (const secret of secrets) assert.ok(!JSON.stringify(response).includes(secret));
    }
    assert.equal(resourceJoins, 0);
    assert.equal(searchPreviewJoins, 1);
    assert.equal(registry.size, 0);
  });

  const malformed =
    `[[variable]]\nname = "private"\nis_secret = true\nvalue = "${secrets[4]}"\n` +
    `[[alerter]]\n[alerter.config.endpoint.params]\nurl = "${secrets[6]}"\nbroken = [\n`;
  for (const scenario of [
    { mode: "inline" },
    { mode: "link" },
    { mode: "auto", threshold: 1 },
    { mode: "auto", threshold: 16384 },
    { mode: "link", inlineFull: true },
    { mode: "auto", inlineFull: true },
    { mode: "link", missingSession: true },
    { mode: "auto", missingSession: true },
    { mode: "link", registrationFailure: true },
    { mode: "auto", threshold: 1, registrationFailure: true },
  ] as const) {
    await t.test(`malformed TOML withheld: ${JSON.stringify(scenario)}`, async (st) => {
      const logs = (["error", "warn"] as const).map((level) => st.mock.method(Logger.prototype, level, () => {}));
      registry.clear();
      config.MCP_RESOURCE_RESPONSE_MODE = scenario.mode;
      config.MCP_RESOURCE_INLINE_THRESHOLD_BYTES = "threshold" in scenario ? scenario.threshold : 16384;
      exportFixture = { toml: malformed };
      if ("missingSession" in scenario) delete serverTransport.sessionId;
      else serverTransport.sessionId = "session-a";
      const register = st.mock.method(registry, "register");
      if ("registrationFailure" in scenario)
        register.mock.mockImplementation(() => {
          throw new Error("registry unavailable");
        });
      for (const tool of [exportAllResourcesToTomlTool, exportResourcesToTomlTool]) {
        const response = await client.callTool({
          name: tool.name,
          arguments: "inlineFull" in scenario ? { inline_full: true } : {},
        });
        assert.equal(response.isError, true);
        assert.equal(response.structuredContent, undefined);
        assert.match(JSON.stringify(response), /TOML export withheld/);
        for (const secret of secrets) assert.ok(!JSON.stringify(response).includes(secret));
        assert.ok(!JSON.stringify(response).includes("broken ="), "parser details must not escape");
      }
      assert.equal(register.mock.callCount(), 0, "invalid TOML must never reach resource registration");
      assert.equal(registry.size, 0);
      for (const log of logs)
        assert.equal(log.mock.callCount(), 0, "parser failures must not be logged with payload details");
    });
  }
  exportFixture = undefined;

  await t.test("TOML auto selection retains the original size while bytes describe the scrubbed export", async () => {
    config.MCP_RESOURCE_RESPONSE_MODE = "auto";
    config.MCP_RESOURCE_INLINE_THRESHOLD_BYTES = 128;
    serverTransport.sessionId = "session-a";
    exportFixture = { toml: `[[variable]]\nis_secret = true\nvalue = "${"s".repeat(512)}"\n` };
    try {
      const response = await client.callTool({ name: exportAllResourcesToTomlTool.name, arguments: {} });
      assert.notEqual(response.isError, true);
      const payload = response.structuredContent as { summary: { bytes: number }; resourceLink: { uri: string } };
      assert.ok(payload.resourceLink);
      const resource = await client.readResource({ uri: payload.resourceLink.uri });
      const content = resource.contents[0];
      assert.ok(content && "text" in content);
      assert.ok(!content.text.includes("s".repeat(512)));
      assert.equal(payload.summary.bytes, Buffer.byteLength(content.text, "utf8"));
      assert.ok(payload.summary.bytes < 128);
    } finally {
      exportFixture = undefined;
    }
  });

  await t.test("non-string TOML payloads are withheld without exposing their values", async () => {
    registry.clear();
    exportFixture = { toml: { raw: secrets[4] } };
    try {
      const response = await client.callTool({ name: exportAllResourcesToTomlTool.name, arguments: {} });
      assert.equal(response.isError, true);
      assert.equal(response.structuredContent, undefined);
      assert.match(JSON.stringify(response), /TOML export withheld/);
      assert.ok(!JSON.stringify(response).includes(secrets[4] ?? "unreachable"));
      assert.equal(registry.size, 0);
    } finally {
      exportFixture = undefined;
    }
  });

  for (const failure of ["scrub", "serialize", "invalid-serialization"] as const) {
    await t.test(`TOML ${failure} failure is safe before either delivery path`, async (st) => {
      const logs = (["error", "warn"] as const).map((level) => st.mock.method(Logger.prototype, level, () => {}));
      registry.clear();
      // Exercise the real local serializer: a scrubber-produced invalid Date throws;
      // an invalid property value serializes to invalid TOML and fails revalidation.
      st.mock.method(SecretScrubber.prototype, "scrubObject", () => {
        if (failure === "scrub") throw new Error(`sensitive internal error: ${secrets[4]}`);
        return failure === "serialize" ? { date: new Date(NaN) } : { invalid: Symbol("not-toml") };
      });
      const register = st.mock.method(registry, "register");
      for (const mode of ["link", "inline", "auto"] as const) {
        config.MCP_RESOURCE_RESPONSE_MODE = mode;
        const response = await client.callTool({ name: exportAllResourcesToTomlTool.name, arguments: {} });
        assert.equal(response.isError, true);
        assert.equal(response.structuredContent, undefined);
        assert.match(JSON.stringify(response), /TOML export withheld: structural/);
        for (const secret of secrets) assert.ok(!JSON.stringify(response).includes(secret));
      }
      assert.equal(register.mock.callCount(), 0);
      assert.equal(registry.size, 0);
      for (const log of logs)
        assert.equal(log.mock.callCount(), 0, "scrub/serializer failures must not log their causes");
    });
  }

  await t.test("scrubber failure withholds an inline fallback instead of exposing secrets", async (st) => {
    config.MCP_RESOURCE_RESPONSE_MODE = "link";
    serverTransport.sessionId = "session-a";
    st.mock.method(registry, "register", () => {
      throw new Error("registration scrub failed");
    });
    st.mock.method(resultScrubber, "scrubObject", () => {
      throw new Error("boundary scrub failed");
    });
    const response = await client.callTool({ name: getStackInfoTool.name, arguments: { stack: "test-stack" } });
    assert.equal(response.isError, true);
    assert.equal(response.structuredContent, undefined);
    assert.match(JSON.stringify(response), /withheld/);
    for (const secret of secrets) assert.ok(!JSON.stringify(response).includes(secret));
  });
  await t.test("explicit redaction opt-out preserves raw export behavior and reports bytes consistently", async () => {
    config.MCP_SECRET_SCRUB_ENABLED = false;
    const sdk = new McpServer({ name: "redaction-disabled", version: "1.0.0" });
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    serverTransport.sessionId = "session-a";
    // These two boundaries deliberately match production's explicit opt-out.
    ToolRegistry.bindToSdk(sdk, tools, { stateless: false, logger, anonymousScopes: [ToolScopes.READ] });
    const rawRegistry = configureDynamicResourceRegistry({ scrub: false, cleanupIntervalMs: 0 });
    try {
      await sdk.connect(serverTransport);
      await client.connect(clientTransport);
      exportFixture = { toml: malformed };
      for (const mode of ["link", "inline", "auto"] as const) {
        config.MCP_RESOURCE_RESPONSE_MODE = mode;
        config.MCP_RESOURCE_INLINE_THRESHOLD_BYTES = 1;
        for (const tool of [exportAllResourcesToTomlTool, exportResourcesToTomlTool]) {
          const response = await client.callTool({ name: tool.name, arguments: {} });
          assert.notEqual(response.isError, true);
          assert.match(JSON.stringify(response.content), /WARNING:.*export may contain unmasked credentials/);
          const payload = response.structuredContent as {
            summary: { bytes: number; secrets_masked: boolean };
            toml?: string;
            resourceLink?: { uri: string };
          };
          assert.equal(payload.summary.secrets_masked, false);
          assert.equal(payload.summary.bytes, Buffer.byteLength(malformed, "utf8"));
          const delivered = payload.resourceLink
            ? rawRegistry.read(payload.resourceLink.uri, "session-a").content
            : payload.toml;
          assert.equal(delivered, malformed);
        }
      }
    } finally {
      await client.close();
      await sdk.close();
      rawRegistry.clear();
      config.MCP_SECRET_SCRUB_ENABLED = true;
      exportFixture = undefined;
    }
  });
});
