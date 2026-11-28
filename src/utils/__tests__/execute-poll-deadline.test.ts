import "../polyfills.js";
import assert from "node:assert/strict";
import { getEventListeners } from "node:events";
import { after, before, mock, test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { Types } from "komodo_client";
import { AuthorizationError, OperationCancelledError } from "mcp-server-framework";
import { configureKomodoConnections, stopKomodoConnections } from "../../client.js";
import { ApiError } from "../../errors/index.js";
import { requireClient } from "../api-helpers.js";
import { wrapExecuteAndPoll } from "../polling.js";

const deadlineMs = 30 * 60 * 1000;
const inProgress = { _id: { $oid: "update-1" }, status: Types.UpdateStatus.InProgress, logs: [{ stage: "deploy" }] };
const complete = { ...inProgress, status: Types.UpdateStatus.Complete, success: true };

before(async () => {
  process.env["KOMODO_URL"] = "http://core.invalid";
  process.env["KOMODO_API_KEY"] = "fixture-key";
  process.env["KOMODO_API_SECRET"] = "fixture-secret";
  const fetch = mock.method(globalThis, "fetch", async () => Response.json({ version: "2.3.4" }));
  try {
    await configureKomodoConnections({ anonymousMode: true });
  } finally {
    fetch.mock.restore();
  }
});

after(stopKomodoConnections);

function execute(action = "fixture") {
  return requireClient().client.execute("RunAction", { action });
}

for (const phase of ["submit", "GetUpdate", "progress", "final progress"] as const) {
  test(`the workflow deadline covers stalled ${phase}`, { timeout: 1_000 }, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
    const paths: string[] = [];
    let httpSignal: AbortSignal | null | undefined;
    let resolveLateResponse: ((response: Response) => void) | undefined;
    let rejectLateProgress: ((error: Error) => void) | undefined;
    t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
      const path = new URL(url).pathname;
      paths.push(path);
      httpSignal = init?.signal;
      if (
        (path === "/execute/RunAction" && phase === "submit") ||
        (path === "/read/GetUpdate" && phase === "GetUpdate")
      ) {
        // Model a transport that delivers a late reply despite being signalled.
        return new Promise<Response>((resolve) => {
          resolveLateResponse = resolve;
        });
      }
      return Response.json(
        phase === "final progress" && path === "/read/GetUpdate" ? { ...complete, logs: [] } : inProgress,
      );
    });
    const reportProgress = t.mock.fn(
      async () =>
        new Promise<boolean>((_, reject) => {
          rejectLateProgress = reject;
        }),
    );
    const result = wrapExecuteAndPoll("deploy", () => execute(), undefined, reportProgress);
    const updateId = phase === "submit" ? "unknown" : "update-1";
    const rejected = assert.rejects(result, (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.ok(error.message.includes(`polling timed out after 1800s (update: ${updateId})`));
      return true;
    });
    await setImmediate();
    t.mock.timers.tick(1_000);
    await setImmediate();
    const expectedPaths = phase === "submit" ? ["/execute/RunAction"] : ["/execute/RunAction", "/read/GetUpdate"];
    const expectedReports = phase.endsWith("progress") ? 1 : 0;
    assert.deepEqual(paths, expectedPaths);
    assert.equal(reportProgress.mock.callCount(), expectedReports);
    t.mock.timers.tick(deadlineMs - 1_000);
    await rejected;
    assert.equal(httpSignal?.aborted, true);

    resolveLateResponse?.(Response.json(complete));
    rejectLateProgress?.(new Error("late reporter failure"));
    await setImmediate();
    t.mock.timers.tick(2_000);
    await setImmediate();
    assert.deepEqual(paths, expectedPaths, "no additional requests, including remote cancellation");
    assert.equal(reportProgress.mock.callCount(), expectedReports);
  });
}

test(
  "pre-cancellation prevents submission, and cancellation during the poll delay prevents any poll",
  { timeout: 1_000 },
  async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let httpSignal: AbortSignal | null | undefined;
    const fetch = t.mock.method(globalThis, "fetch", async (_url: string, init?: RequestInit) => {
      httpSignal = init?.signal;
      return Response.json(inProgress);
    });
    await assert.rejects(
      wrapExecuteAndPoll("deploy", () => execute(), AbortSignal.abort()),
      OperationCancelledError,
    );
    assert.equal(fetch.mock.callCount(), 0);

    const caller = new AbortController();
    const rejected = assert.rejects(
      wrapExecuteAndPoll("deploy", () => execute(), caller.signal),
      OperationCancelledError,
    );
    await setImmediate();
    assert.equal(fetch.mock.callCount(), 1);
    caller.abort("client stopped");
    await rejected;
    t.mock.timers.tick(deadlineMs);
    await setImmediate();
    assert.equal(fetch.mock.callCount(), 1);
    assert.equal(httpSignal?.aborted, true);
    assert.deepEqual(getEventListeners(httpSignal, "abort"), []);
  },
);

test(
  "concurrent workflows have independent cancellation, completed results and timers",
  { timeout: 1_000 },
  async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const signals: AbortSignal[] = [];
    t.mock.method(globalThis, "fetch", async (_url: string, init?: RequestInit) => {
      const signal = init?.signal;
      const headers = new Headers(init?.headers);
      assert.ok(signal);
      assert.equal(headers.get("x-api-key"), "fixture-key");
      assert.equal(headers.get("x-api-secret"), "fixture-secret");
      signals.push(signal);
      if (signals.length === 1) {
        return new Promise<Response>((_, reject) => {
          signal.addEventListener("abort", () => reject(new DOMException("Request aborted", "AbortError")), {
            once: true,
          });
        });
      }
      return Response.json(complete);
    });
    const caller = new AbortController();
    const cancelled = assert.rejects(
      wrapExecuteAndPoll("first", () => execute("first"), caller.signal),
      OperationCancelledError,
    );
    const unaffected = wrapExecuteAndPoll("second", () => execute("second"));
    caller.abort();
    await cancelled;
    assert.deepEqual(await unaffected, complete);
    t.mock.timers.tick(deadlineMs);
    assert.deepEqual(
      signals.map((signal) => signal.aborted),
      [true, false],
      "the completed workflow cleared its deadline",
    );
    assert.deepEqual(
      signals.map((signal) => getEventListeners(signal, "abort")),
      [[], []],
    );
  },
);

test(
  "normal polling reports stages and completion, and preserves Komodo authorization errors",
  { timeout: 1_000 },
  async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
    const responses = [
      Response.json(inProgress),
      Response.json(complete),
      Response.json({ error: "permission denied" }, { status: 403 }),
    ];
    t.mock.method(globalThis, "fetch", async () => {
      const response = responses.shift();
      assert.ok(response);
      return response;
    });
    const reportProgress = t.mock.fn(async () => true);
    const result = wrapExecuteAndPoll("deploy", () => execute(), undefined, reportProgress);
    await setImmediate();
    t.mock.timers.tick(1_000);
    assert.deepEqual(await result, complete);
    assert.equal(reportProgress.mock.callCount(), 2);
    assert.deepEqual(
      reportProgress.mock.calls.map(({ arguments: args }) => args),
      [
        [{ progress: 1, message: "deploy: deploy (1s)" }],
        [{ progress: 1, total: 1, message: "deploy: complete (1s)" }],
      ],
    );
    await assert.rejects(
      wrapExecuteAndPoll("unauthorized", () => execute()),
      AuthorizationError,
    );
  },
);
