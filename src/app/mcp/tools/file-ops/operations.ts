/**
 * File Operations Tools
 *
 * MCP tools for writing file contents to stacks, builds, and syncs,
 * and refreshing caches for various resource types.
 *
 * @module tools/file-ops/operations
 */

import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

// ── File Content Write Tools ─────────────────────────────────────────

export const writeStackFileTool: Tool = {
  name: 'komodo_write_stack_file',
  description:
    'Write file contents to a Komodo-managed stack. Used to update compose files or other stack configuration files.',
  schema: z.object({
    stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID),
    file_path: z.string().describe('Path of the file within the stack'),
    contents: z.string().describe('File contents to write'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_write_stack_file');
    const result = await wrapApiCall(
      'writeStackFileContents',
      () =>
        validClient.fileOps.writeStackFileContents(args.stack, args.file_path, args.contents, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `File "${args.file_path}" written to stack "${args.stack}" successfully.\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const writeBuildFileTool: Tool = {
  name: 'komodo_write_build_file',
  description: 'Write file contents (e.g., Dockerfile) to a Komodo-managed build.',
  schema: z.object({
    build: z.string().describe(PARAM_DESCRIPTIONS.BUILD_ID),
    contents: z.string().describe('File contents to write'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_write_build_file');
    const result = await wrapApiCall(
      'writeBuildFileContents',
      () => validClient.fileOps.writeBuildFileContents(args.build, args.contents, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`File written to build "${args.build}" successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const writeSyncFileTool: Tool = {
  name: 'komodo_write_sync_file',
  description: 'Write file contents to a Komodo-managed resource sync.',
  schema: z.object({
    sync: z.string().describe(PARAM_DESCRIPTIONS.SYNC_ID),
    resource_path: z.string().describe('Resource path within the sync'),
    file_path: z.string().describe('Path of the file to write'),
    contents: z.string().describe('File contents to write'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_write_sync_file');
    const result = await wrapApiCall(
      'writeSyncFileContents',
      () =>
        validClient.fileOps.writeSyncFileContents(args.sync, args.resource_path, args.file_path, args.contents, {
          signal: abortSignal,
        }),
      abortSignal,
    );
    return successResponse(
      `File "${args.file_path}" written to sync "${args.sync}" successfully.\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

// ── Cache Refresh Tools ──────────────────────────────────────────────

export const refreshStackCacheTool: Tool = {
  name: 'komodo_refresh_stack_cache',
  description: 'Refresh the cached state for a Komodo-managed stack. Useful after external changes.',
  schema: z.object({
    stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_refresh_stack_cache');
    const result = await wrapApiCall(
      'refreshStackCache',
      () => validClient.fileOps.refreshStackCache(args.stack, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Cache refreshed for stack "${args.stack}".\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const refreshBuildCacheTool: Tool = {
  name: 'komodo_refresh_build_cache',
  description: 'Refresh the cached state for a Komodo-managed build. Useful after external changes.',
  schema: z.object({
    build: z.string().describe(PARAM_DESCRIPTIONS.BUILD_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_refresh_build_cache');
    const result = await wrapApiCall(
      'refreshBuildCache',
      () => validClient.fileOps.refreshBuildCache(args.build, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Cache refreshed for build "${args.build}".\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const refreshRepoCacheTool: Tool = {
  name: 'komodo_refresh_repo_cache',
  description: 'Refresh the cached state for a Komodo-managed repo. Useful after external changes.',
  schema: z.object({
    repo: z.string().describe(PARAM_DESCRIPTIONS.REPO_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_refresh_repo_cache');
    const result = await wrapApiCall(
      'refreshRepoCache',
      () => validClient.fileOps.refreshRepoCache(args.repo, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Cache refreshed for repo "${args.repo}".\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const refreshResourceSyncPendingTool: Tool = {
  name: 'komodo_refresh_resource_sync_pending',
  description: 'Refresh the pending state for a Komodo-managed resource sync.',
  schema: z.object({
    sync: z.string().describe(PARAM_DESCRIPTIONS.SYNC_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_refresh_resource_sync_pending');
    const result = await wrapApiCall(
      'refreshResourceSyncPending',
      () => validClient.fileOps.refreshResourceSyncPending(args.sync, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Pending state refreshed for sync "${args.sync}".\n\n${JSON.stringify(result, null, 2)}`);
  },
};
