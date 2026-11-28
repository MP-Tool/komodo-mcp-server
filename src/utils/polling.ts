/**
 * Polling Utilities
 *
 * Execute-and-poll workflow for long-running Komodo operations.
 * Provides cancellation via AbortSignal, progress reporting,
 * and timeout enforcement on top of `komodo_client.execute()`.
 *
 * @module utils/polling
 */

import { addAbortListener } from "node:events";
import timers from "node:timers/promises";
import { Types } from "komodo_client";
import type { ProgressReporter } from "mcp-server-framework";
import { OperationCancelledError, getCurrentToolContext } from "mcp-server-framework";
import type { KomodoClient } from "../client.js";
import { ApiError } from "../errors/index.js";
import { requireClient, checkCancelled, wrapApiCall } from "./api-helpers.js";
import { getKomodoRequestSignal, runWithKomodoRequestSignal } from "./request-signal.js";

type Update = Types.Update;

// ============================================================================
// Polling Constants
// ============================================================================

/** Interval between status polls (ms) */
const POLL_INTERVAL_MS = 1_000;

/** Maximum time to submit an operation and wait for it to complete (30 minutes) */
const POLL_MAX_DURATION_MS = 1_800_000;

/** Interval between progress reports to the MCP client (ms) */
const POLL_PROGRESS_INTERVAL_MS = 5_000;

// ============================================================================
// Update Helpers
// ============================================================================

/**
 * Extract the MongoDB ObjectId string from a Komodo Update object.
 */
export function extractUpdateId(update: { _id?: { $oid?: string } }): string {
  return update._id?.$oid || "unknown";
}

// ============================================================================
// Polling
// ============================================================================

/**
 * Polls a Komodo update until its status reaches `Complete`.
 *
 * Komodo updates follow the lifecycle `Queued → InProgress → Complete`.
 * During `InProgress`, the backend appends log entries to `update.logs[]`
 * via `update_update()` — each entry represents a completed stage
 * (e.g. "Deploy Container", "Clone Repo", "Diff compose files").
 *
 * Progress is reported based on these **real operation stages**:
 * - New stages are reported immediately when detected
 * - Between stages, a heartbeat is sent every {@link POLL_PROGRESS_INTERVAL_MS}
 * - Progress is **indeterminate** (no `total`) because stage count varies
 *   per operation (typically 1–8) and is not known upfront
 *
 * @param client     - Komodo API client
 * @param updateId   - The `_id.$oid` of the Update returned by `execute()`
 * @param operation  - Human-readable operation name (for progress messages)
 * @param signal     - The combined caller cancellation and workflow deadline
 * @param reportProgress - MCP progress reporter (optional)
 * @returns The final Update with `status === "Complete"`
 */
async function pollUntilComplete(
  client: KomodoClient,
  updateId: string,
  operation: string,
  signal: AbortSignal,
  reportProgress?: ProgressReporter,
): Promise<Update> {
  const startTime = Date.now();
  let lastProgressTime = 0;
  let lastStageCount = 0;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- intentional polling loop, exits via return or throw
  while (true) {
    // Wait one poll interval
    await timers.setTimeout(POLL_INTERVAL_MS, undefined, { signal });
    const elapsed = Date.now() - startTime;

    // Poll status
    const update = await wrapApiCall(
      `${operation} (poll)`,
      () => client.client.read("GetUpdate", { id: updateId }),
      signal,
    );
    signal.throwIfAborted();

    const logs = update.logs;
    const stageCount = logs.length;
    const elapsedSec = Math.round(elapsed / 1000);

    if (reportProgress) {
      if (stageCount > lastStageCount) {
        lastStageCount = stageCount;
        lastProgressTime = elapsed;
        const latestStage = logs[stageCount - 1]?.stage ?? "processing";
        await reportProgress({
          progress: stageCount,
          message: `${operation}: ${latestStage} (${elapsedSec}s)`,
        });
      } else if (elapsed - lastProgressTime >= POLL_PROGRESS_INTERVAL_MS) {
        lastProgressTime = elapsed;
        await reportProgress({
          progress: stageCount,
          message: `${operation}: in progress (${elapsedSec}s)`,
        });
      }
      signal.throwIfAborted();
    }

    if (update.status === Types.UpdateStatus.Complete) {
      if (reportProgress) {
        const totalSec = Math.round((Date.now() - startTime) / 1000);
        await reportProgress({
          progress: stageCount,
          total: stageCount || 1,
          message: `${operation}: complete (${totalSec}s)`,
        });
        signal.throwIfAborted();
      }
      // Record the operation's effect on the tool.call audit entry (what was produced).
      getCurrentToolContext()?.recordAuditDetail({
        effect: {
          updateId: extractUpdateId(update),
          status: update.status,
          success: update.success,
        },
      });
      return update;
    }
  }
}

/**
 * Executes a Komodo action and polls until the operation completes.
 *
 * Replaces the direct use of `komodo_client.execute_and_poll()` to add:
 * - Cancellation via AbortSignal
 * - Progress reporting to the MCP client
 * - A single deadline for submission, polling and progress
 *
 * For instant operations (status already `Complete` after `execute()`),
 * the polling loop is skipped entirely.
 * Stopping this wait cannot undo an operation Komodo has already received.
 */
export async function wrapExecuteAndPoll(
  operation: string,
  executeCall: () => Promise<Update>,
  signal = getKomodoRequestSignal() ?? getCurrentToolContext()?.abortSignal,
  reportProgress?: ProgressReporter,
): Promise<Update> {
  checkCancelled(signal, operation);

  const client = requireClient();
  const deadline = new AbortController();
  const workflowSignal = signal ? AbortSignal.any([signal, deadline.signal]) : deadline.signal;
  const timer = setTimeout(() => deadline.abort(), POLL_MAX_DURATION_MS);
  let abortListener: ReturnType<typeof addAbortListener> | undefined;
  const stopped = new Promise<never>((_, reject) => {
    abortListener = addAbortListener(workflowSignal, () => reject(new OperationCancelledError(operation)));
  });
  let updateId = "unknown";
  try {
    const workflow = runWithKomodoRequestSignal(workflowSignal, async () => {
      const update = await wrapApiCall(operation, executeCall, workflowSignal);
      workflowSignal.throwIfAborted();
      if (update.status === Types.UpdateStatus.Complete) return update;

      updateId = extractUpdateId(update);
      return await pollUntilComplete(client, updateId, operation, workflowSignal, reportProgress);
    });
    return await Promise.race([workflow, stopped]);
  } catch (error) {
    checkCancelled(signal, operation);
    if (deadline.signal.aborted) {
      throw ApiError.requestFailed(
        `${operation}: polling timed out after ${POLL_MAX_DURATION_MS / 1000}s (update: ${updateId})`,
      );
    }

    if (OperationCancelledError.isCancellation(error)) {
      throw new OperationCancelledError(operation);
    }
    // All other errors already wrapped by wrapApiCall
    throw error;
  } finally {
    clearTimeout(timer);
    abortListener?.[Symbol.dispose]();
  }
}

// ============================================================================
// Action Result Payload
// ============================================================================

/**
 * Typed `actionResultSchema`-shaped payload built from a completed Update.
 */
export interface ActionResult {
  readonly success: boolean;
  readonly status: string;
  readonly action: string;
  readonly resource_type: string;
  readonly resource_id: string;
  readonly server?: string;
  readonly version?: string;
  readonly [key: string]: unknown;
}

export function buildActionResult(
  update: Update,
  action: string,
  resourceType: string,
  resourceId: string,
  serverName?: string,
): ActionResult {
  const version = update.version
    ? `${update.version.major}.${update.version.minor}.${update.version.patch}`
    : undefined;

  return {
    success: update.success,
    status: update.status,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    ...(serverName !== undefined ? { server: serverName } : {}),
    ...(version !== undefined ? { version } : {}),
  };
}
