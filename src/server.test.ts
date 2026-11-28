import "./utils/polyfills.js";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ToolRegistry, logger } from "mcp-server-framework";
import { deleteStackTool } from "./tools/stack.js";
import { ToolScopes } from "./config/index.js";

const entry = process.env["KOMODO_CATEGORY_TEST_ENTRY"] ?? fileURLToPath(new URL("./index.js", import.meta.url));
const env = { PATH: process.env["PATH"] ?? "", MCP_TRANSPORT: "stdio", LOG_LEVEL: "error" };

await test("unknown category settings reject startup, including mixed lists", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "komodo-categories-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const setting of ["MCP_TOOLS_ALLOWED_CATEGORIES", "MCP_TOOLS_EXCLUDED_CATEGORIES"]) {
    for (const value of ["typo", "stack,typo"]) {
      for (const source of ["env", "file"]) {
        await t.test(`${source}: ${setting}=${value}`, async () => {
          const key = setting === "MCP_TOOLS_ALLOWED_CATEGORIES" ? "allowed_categories" : "excluded_categories";
          const file = join(directory, "config.toml");
          // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed fixture name in a fresh temporary directory.
          await writeFile(file, `[tools]\n${key} = ${JSON.stringify(value.split(","))}\n`);
          const settings = source === "env" ? { [setting]: value } : { MCP_CONFIG_FILE_PATH: file };
          const child = spawn(process.execPath, [entry], { env: { ...env, ...settings } });
          let stderr = "";
          child.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString();
          });
          const code = await new Promise<number | null>((resolve, reject) => {
            // A fail-open server stays alive on stdin; bound the upstream reproduction.
            const timeout = setTimeout(() => child.kill(), 3000).unref();
            child.once("error", (error) => {
              clearTimeout(timeout);
              reject(error);
            });
            child.once("exit", (code) => {
              clearTimeout(timeout);
              resolve(code);
            });
          });
          assert.equal(code, 1, stderr);
          assert.ok(stderr.includes(setting), stderr);
          assert.match(stderr, /typo/);
          assert.match(stderr, /valid categories/i);
        });
      }
    }
  }
});

await test("unset/empty lists and valid filters work through env and file config", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "komodo-valid-categories-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let unfiltered: string[] | undefined;
  for (const settings of [
    {},
    { MCP_TOOLS_ALLOWED_CATEGORIES: "", MCP_TOOLS_EXCLUDED_CATEGORIES: "" },
    { MCP_TOOLS_ALLOWED_CATEGORIES: " , , " },
    {
      MCP_TOOLS_ALLOWED_CATEGORIES: "stack,toml",
      MCP_TOOLS_EXCLUDED_CATEGORIES: "toml",
      MCP_TOOLS_EXCLUDED_TOOLS: "komodo_stack_action",
    },
  ]) {
    for (const source of ["env", "file"]) {
      await t.test(`${source}: ${JSON.stringify(settings)}`, async (st) => {
        const file = join(directory, "config.toml");
        const fields = {
          allowed_categories: settings.MCP_TOOLS_ALLOWED_CATEGORIES,
          excluded_categories: settings.MCP_TOOLS_EXCLUDED_CATEGORIES,
          excluded_tools: settings.MCP_TOOLS_EXCLUDED_TOOLS,
        };
        const lines = Object.entries(fields)
          .filter(([, value]) => value !== undefined)
          .map(
            ([key, value]) =>
              `${key} = ${JSON.stringify(
                value
                  ?.split(",")
                  .map((name) => name.trim())
                  .filter(Boolean) ?? [],
              )}`,
          );
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed fixture name in a fresh temporary directory.
        await writeFile(file, `[tools]\n${lines.join("\n")}\n`);
        const childSettings = source === "env" ? settings : { MCP_CONFIG_FILE_PATH: file };
        const transport = new StdioClientTransport({
          command: process.execPath,
          args: [entry],
          env: { ...env, ...childSettings },
          stderr: "pipe",
        });
        transport.stderr?.on("data", () => {});
        const client = new Client({ name: "category-regression", version: "1" });
        st.after(() => client.close());
        await client.connect(transport);
        const names: string[] = [];
        let cursor: string | undefined;
        do {
          const page = await client.listTools(cursor ? { cursor } : {});
          names.push(...page.tools.map((tool) => tool.name));
          cursor = page.nextCursor;
        } while (cursor);
        names.sort();
        if (!unfiltered) {
          unfiltered = names;
          assert.ok(names.length > 50);
        } else if (!settings.MCP_TOOLS_EXCLUDED_TOOLS) assert.deepEqual(names, unfiltered);
        else {
          assert.ok(names.includes("komodo_stack_info"));
          assert.ok(names.includes("komodo_stack_delete"));
          assert.ok(names.every((name) => name.startsWith("komodo_stack_")));
          assert.ok(!names.includes("komodo_stack_action"));
          const removed = await client.callTool({
            name: "komodo_stack_action",
            arguments: { stack: "fixture", action: "stop" },
          });
          assert.equal(removed.isError, true);
        }
      });
    }
  }
});

await test("a retained category does not bypass read-only scope enforcement", async (t) => {
  const sdk = new McpServer({ name: "scope-regression", version: "1" });
  const client = new Client({ name: "read-only-client", version: "1" });
  t.after(async () => {
    await client.close();
    await sdk.close();
  });
  const registry = ToolRegistry.createIsolated();
  registry.registerFromFactory(deleteStackTool);
  ToolRegistry.bindToSdk(sdk, registry.getTools(), { logger, stateless: false, anonymousScopes: [ToolScopes.READ] });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await sdk.connect(serverTransport);
  await client.connect(clientTransport);
  const denied = await client.callTool({ name: deleteStackTool.name, arguments: { stack: "fixture" } });
  assert.equal(denied.isError, true);
  assert.match(JSON.stringify(denied), /scope|permission|not found/i);
});
