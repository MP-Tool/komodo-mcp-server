/**
 * Polling Utilities
 *
 * Execute-and-poll workflow for long-running Komodo operations.
 * Provides cancellation via AbortSignal, progress reporting,
 * and timeout enforcement on top of `komodo_client.execute()`.
 *
 * @module utils/polling
 */

import { Types } from "komodo_client";
import type { ProgressReporter } from "mcp-server-framework";
import { OperationCancelledError } from "mcp-server-framework";
import type { KomodoClient } from "../client.js";
import { ApiError } from "../errors/index.js";
import { formatCompletedActionResponse, type ActionType, type ResourceType } from "./response-formatter.js";
import { requireClient, checkCancelled, wrapApiCall } from "./api-helpers.js";

type Update = Types.Update;

// ============================================================================
// Polling Constants
// ============================================================================

/** Interval between status polls (ms) */
const POLL_INTERVAL_MS = 1_000;

/** Maximum time to wait for an operation to complete (30 minutes) */
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
 * Unlike `komodo_client.execute_and_poll()` this implementation:
 * - Checks `abortSignal` every iteration for immediate cancellation
 * - Reports progress to the MCP client every {@link POLL_PROGRESS_INTERVAL_MS}
 * - Enforces a maximum timeout of {@link POLL_MAX_DURATION_MS}
 *
 * @param client     - Komodo API client
 * @param updateId   - The `_id.$oid` of the Update returned by `execute()`
 * @param operation  - Human-readable operation name (for error messages)
 * @param signal     - AbortSignal for cancellation
 * @param reportProgress - MCP progress reporter (optional)
 * @returns The final Update with `status === "Complete"`
 */
async function pollUntilComplete(
  client: KomodoClient,
  updateId: string,
  operation: string,
  signal?: AbortSignal,
  reportProgress?: ProgressReporter,
): Promise<Update> {
  const startTime = Date.now();
  let lastProgressTime = 0;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- intentional polling loop, exits via return or throw
  while (true) {
    checkCancelled(signal, operation);

    // Wait one poll interval
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

    checkCancelled(signal, operation);

    const elapsed = Date.now() - startTime;

    // Enforce maximum timeout
    if (elapsed > POLL_MAX_DURATION_MS) {
      throw ApiError.requestFailed(
        `${operation}: polling timed out after ${Math.round(elapsed / 1000)}s (update: ${updateId})`,
      );
    }

    // Report progress at intervals
    if (reportProgress && elapsed - lastProgressTime >= POLL_PROGRESS_INTERVAL_MS) {
      lastProgressTime = elapsed;
      const elapsedSec = Math.round(elapsed / 1000);
      await reportProgress({ progress: elapsedSec, message: `${operation}: polling... (${elapsedSec}s)` });
    }

    // Poll status
    const update = await wrapApiCall(
      `${operation} (poll)`,
      () => client.client.read("GetUpdate", { id: updateId }),
      signal,
    );

    if (update.status === Types.UpdateStatus.Complete) {
      // Final progress report
      if (reportProgress) {
        const totalSec = Math.round((Date.now() - startTime) / 1000);
        await reportProgress({ progress: totalSec, message: `${operation}: complete (${totalSec}s)` });
      }
      return update;
    }
  }
}

/**
 * Executes a Komodo action and polls until the operation completes.
 *
 * Replaces the direct use of `komodo_client.execute_and_poll()` to add:
 * - Cancellation via AbortSignal (checked every poll iteration)
 * - Progress reporting to the MCP client
 * - Maximum timeout enforcement
 *
 * For instant operations (status already `Complete` after `execute()`),
 * the polling loop is skipped entirely.
 */
export async function wrapExecuteAndPoll(
  operation: string,
  executeCall: () => Promise<Update>,
  signal?: AbortSignal,
  reportProgress?: ProgressReporter,
): Promise<Update> {
  checkCancelled(signal, operation);

  const client = requireClient();

  try {
    const update = await wrapApiCall(operation, executeCall, signal);
    checkCancelled(signal, operation);

    // If already complete, skip polling
    if (update.status === Types.UpdateStatus.Complete) {
      return update;
    }

    // Poll until complete with cancellation + progress
    const updateId = extractUpdateId(update);
    return await pollUntilComplete(client, updateId, operation, signal, reportProgress);
  } catch (error) {
    checkCancelled(signal, operation);

    if (OperationCancelledError.isCancellation(error)) {
      throw new OperationCancelledError(operation);
    }
    // All other errors already wrapped by wrapApiCall
    throw error;
  }
}

// ============================================================================
// Update Formatting
// ============================================================================

/**
 * Format a completed Update into a rich response string.
 */
export function formatUpdateResult(
  update: Update,
  action: ActionType,
  resourceType: ResourceType,
  resourceId: string,
  serverName?: string,
): string {
  const version = update.version
    ? `${update.version.major}.${update.version.minor}.${update.version.patch}`
    : undefined;

  const opts: Parameters<typeof formatCompletedActionResponse>[0] = {
    action,
    resourceType,
    resourceId,
    updateId: extractUpdateId(update),
    success: update.success,
    status: update.status,
    logs: update.logs,
  };
  if (serverName !== undefined) opts.serverName = serverName;
  if (version !== undefined) opts.version = version;
  return formatCompletedActionResponse(opts);
}
