// Must precede any komodo_client import — mogh_auth_client touches localStorage at load.
import "../utils/polyfills.js";

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";

// ============================================================================
// komodo_resource_sync_action, run against a stand-in for Komodo Core.
//
// The stand-in answers the version probe and RunSync with a finished update, so
// the handler runs end to end through the real client and global connection.
// ============================================================================

const requests: string[] = [];
const core = createServer((req: IncomingMessage, res) => {
  requests.push(`${req.method} ${req.url}`);
  req.resume();
  res.setHeader("Content-Type", "application/json");
  if (req.url?.includes("RunSync")) {
    res.end(
      JSON.stringify({ _id: { $oid: "update-1" }, operation: "RunSync", status: "Complete", success: true, logs: [] }),
    );
  } else {
    res.end(JSON.stringify({ version: "2.3.1" }));
  }
});
await new Promise<void>((resolve) => core.listen(0, "127.0.0.1", resolve));

// The config is parsed on import, so the environment has to be in place first.
process.env["KOMODO_URL"] = `http://127.0.0.1:${(core.address() as AddressInfo).port}`;
process.env["KOMODO_API_KEY"] = "K-test";
process.env["KOMODO_API_SECRET"] = "S-test";
process.env["MCP_CONFIRM_DESTRUCTIVE"] = "false";

const { configureKomodoConnections, stopKomodoConnections } = await import("../client.js");
const { resourceSyncActionTool } = await import("./resource-sync.js");

after(() => {
  stopKomodoConnections();
  core.close();
});

test("a resource sync run reports the run action, not deploy", async () => {
  await configureKomodoConnections({ anonymousMode: true });
  const result = await resourceSyncActionTool.handler({ action: "run", resource_sync: "sync-a" }, {
    abortSignal: new AbortController().signal,
    reportProgress: async () => {},
  } as never);

  assert.ok(
    requests.some((r) => r.includes("RunSync")),
    `RunSync not called: ${requests.join(", ")}`,
  );
  assert.equal((result.structuredContent as { action: string }).action, "run");
  const text = result.content.map((c) => (c.type === "text" ? c.text : "")).join("\n");
  assert.doesNotMatch(text, /deployed/);
});
