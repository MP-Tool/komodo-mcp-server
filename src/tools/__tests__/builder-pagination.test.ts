import "../../utils/polyfills.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ToolContext } from "mcp-server-framework";
import { configureKomodoConnections, stopKomodoConnections } from "../../client.js";
import { listBuildersTool } from "../builder.js";

test("builder lists preserve the exact total and every cursor page across Core versions", async (t) => {
  const builders = Array.from({ length: 63 }, (_, index) => ({
    id: String(index),
    name: `builder-${index}`,
    info: { builder_type: "Server" },
  }));
  const context: ToolContext = {
    abortSignal: new AbortController().signal,
    caller: { remoteAddress: undefined },
    recordAuditDetail: () => {},
    requestId: 1,
    sendNotification: async () => {},
    stateless: false,
  };
  const environment = { ...process.env };
  t.after(() => {
    stopKomodoConnections();
    process.env = environment;
  });
  process.env["KOMODO_URL"] = "http://core.invalid";
  process.env["KOMODO_API_KEY"] = "test-key";
  process.env["KOMODO_API_SECRET"] = "test-secret";
  let version = "2.2.0";
  const requestedLimits: Array<number | undefined> = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    if (url.endsWith("/version")) return new Response("2.3.4");
    if (url.endsWith("/GetVersion")) return Response.json({ version });
    assert.equal(new URL(url).pathname, "/read/ListBuilders");
    assert.ok(typeof init.body === "string");
    const params = JSON.parse(init.body) as { limit?: number };
    requestedLimits.push(params.limit);
    // Core's default is 50. Also exercise a lower operator-configured limit.
    const defaultLimit = version === "2.3.0" ? 50 : 30;
    const result = version === "2.2.0" || params.limit === 0 ? builders : builders.slice(0, defaultLimit);
    return Response.json(result);
  });
  await configureKomodoConnections({ anonymousMode: true });

  for (version of ["2.2.0", "2.3.0", "2.3.4"]) {
    await t.test(`Core ${version}`, async () => {
      requestedLimits.length = 0;
      const ids: string[] = [];
      let cursor: string | undefined;
      for (const expectedCount of [25, 25, 13]) {
        const args = listBuildersTool.input.parse({ cursor, page_size: 25 });
        const result = await listBuildersTool.handler(args, context);
        const output = listBuildersTool.output;
        assert.ok(output);
        const { items, page } = output.parse(result.structuredContent);
        assert.ok(page);
        assert.equal(page.total, 63);
        assert.equal(items.length, expectedCount);
        ids.push(...items.map(({ id }) => id));
        cursor = page.next_cursor;
        assert.equal(cursor !== undefined, expectedCount === 25);
      }
      assert.deepEqual(
        ids,
        builders.map(({ id }) => id),
      );
      assert.deepEqual(requestedLimits, [0, 0, 0], "every ListBuilders request must send limit: 0");
    });
  }
});
