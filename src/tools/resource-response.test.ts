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
import { createSecretScrubber } from "mcp-server-framework/logger";
import { parse as parseToml } from "smol-toml";
import { config, ToolScopes } from "../config/index.js";
import { KomodoClient, configureKomodoConnections, stopKomodoConnections } from "../client.js";
import { resolveScrubOptions } from "../utils/redact.js";
import { getStackInfoTool } from "./stack.js";
import { inspectContainerTool, getContainerLogsTool } from "./container.js";
import { exportAllResourcesToTomlTool, exportResourcesToTomlTool } from "./toml.js";

// These tests exercise real tool handlers, SDK output-schema validation, the
// framework result scrubber, scrub-on-register, and MCP resources/read. Only
// Komodo's downstream API is mocked; no network or production access is used.
test("adaptive delivery preserves complete, redacted tool results across the MCP boundary", async (t) => {
  const originalConfig = { ...config };
  const originalEnv = { ...process.env };
  const registry = configureDynamicResourceRegistry({ scrub: resolveScrubOptions(), cleanupIntervalMs: 0 });
  const resultScrubber = createSecretScrubber(resolveScrubOptions());
  assert.ok(resultScrubber);
  let padding = "";
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
        return { stdout: `API_TOKEN=${secrets[3]}\n${padding}\ncomplete-log-end`, stderr: "" };
      case "ExportAllResourcesToToml":
      case "ExportResourcesToToml":
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
  toolRegistry.registerFromFactory(exportAllResourcesToTomlTool);
  toolRegistry.registerFromFactory(exportResourcesToTomlTool);
  const tools = toolRegistry.getTools();
  ToolRegistry.bindToSdk(sdk, tools, { stateless: false, logger, resultScrubber, anonymousScopes: [ToolScopes.READ] });
  const resourceRegistry = ResourceRegistry.createIsolated();
  resourceRegistry.registerTemplateFromFactory(defineDynamicResourceTemplate({ registry }));
  ResourceRegistry.bindToSdk(sdk, [], resourceRegistry.getTemplates(), { logger, resultScrubber });
  await sdk.connect(serverTransport);
  await client.connect(clientTransport);

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
      padding = scenario.large ? "x".repeat(20000) : "benign-data";
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
          full = payload["info"] ?? payload["inspect"] ?? payload["stdout"] ?? payload["toml"];
        }
        for (const secret of secrets)
          assert.ok(!JSON.stringify(response).includes(secret), `tool result leaked ${secret}`);
        assert.ok(JSON.stringify(full).includes(padding), `${tool.name} lost full payload data`);
        if (tool.name === getStackInfoTool.name) assert.ok(!JSON.stringify(full).includes("deployed_config"));
        if (tool.name === exportAllResourcesToTomlTool.name || tool.name === exportResourcesToTomlTool.name) {
          assert.equal((payload["summary"] as { secrets_masked: boolean }).secrets_masked, true);
          assert.equal(typeof full, "string");
          const parsed = parseToml(full as string);
          assert.equal((parsed["variable"] as { is_secret: boolean }[])[0]?.is_secret, true);
        }
      }
      if (!scenario.link) assert.equal(registry.size, 0, "inline delivery must not retain resource copies");
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
});
