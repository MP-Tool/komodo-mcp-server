import assert from "node:assert/strict";
import test from "node:test";

await import("../build/utils/polyfills.js");
const framework = await import("mcp-server-framework");
const { komodoConnection } = await import("../build/client.js");
const { inspectContainerTool } = await import("../build/tools/container.js");
const { getStackInfoTool } = await import("../build/tools/stack.js");
const { buildApplyResult, buildDeleteResult } = await import("../build/utils/response-formatter.js");

const sentinel = "sentinel-never-return";
const signal = new AbortController().signal;

function fakeClient(result) {
  return { client: { read: async () => structuredClone(result) } };
}

test("container inspect redacts both inline and resource-link payloads", async () => {
  komodoConnection.getClient = () =>
    fakeClient({ Config: { Env: [`API_KEY=${sentinel}`, "PORT=9180"] }, Name: "safe-name" });

  const inline = await inspectContainerTool.handler(
    { server: "server", container: "container", inline_full: true },
    { abortSignal: signal },
  );
  const inlineJson = JSON.stringify(inline.structuredContent);
  assert.doesNotMatch(inlineJson, new RegExp(sentinel));
  assert.match(inlineJson, /\[REDACTED\]/);

  framework.resetDynamicResourceRegistry();
  framework.configureDynamicResourceRegistry({ uriScheme: "ephemeral", maxEntries: 10 });
  const linked = await inspectContainerTool.handler(
    { server: "server", container: "container" },
    { abortSignal: signal, sessionId: "redaction-test" },
  );
  const resource = await framework
    .getDynamicResourceRegistry()
    .read(linked.structuredContent.resourceLink.uri, "redaction-test");
  assert.doesNotMatch(resource.content, new RegExp(sentinel));
  assert.match(resource.content, /\[REDACTED\]/);
});

test("stack info redacts both inline and resource-link payloads", async () => {
  komodoConnection.getClient = () =>
    fakeClient({ config: { environment: `PORT=9180\nKOMODO_API_SECRET=${sentinel}` }, name: "safe-stack" });

  const inline = await getStackInfoTool.handler(
    { stack: "stack", inline_full: true },
    { abortSignal: signal },
  );
  const inlineJson = JSON.stringify(inline.structuredContent);
  assert.doesNotMatch(inlineJson, new RegExp(sentinel));
  assert.match(inlineJson, /\[REDACTED\]/);

  framework.resetDynamicResourceRegistry();
  framework.configureDynamicResourceRegistry({ uriScheme: "ephemeral", maxEntries: 10 });
  const linked = await getStackInfoTool.handler(
    { stack: "stack" },
    { abortSignal: signal, sessionId: "redaction-test" },
  );
  const resource = await framework
    .getDynamicResourceRegistry()
    .read(linked.structuredContent.resourceLink.uri, "redaction-test");
  assert.doesNotMatch(resource.content, new RegExp(sentinel));
  assert.match(resource.content, /\[REDACTED\]/);
});

test("shared apply and delete responses redact returned resource snapshots", () => {
  const resource = { config: { environment: `API_SECRET=${sentinel}\nPUBLIC_NAME=visible` } };
  for (const built of [
    buildApplyResult("create", "stack", "stack", resource),
    buildDeleteResult("stack", "stack", resource),
  ]) {
    const output = JSON.stringify(built);
    assert.doesNotMatch(output, new RegExp(sentinel));
    assert.match(output, /\[REDACTED\]/);
    assert.match(output, /PUBLIC_NAME=visible/);
  }
});
