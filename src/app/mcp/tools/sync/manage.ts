import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { extractUpdateId } from '../../../api/utils.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';
import { formatActionResponse } from '../../../utils/index.js';

export const getSyncTool: Tool = {
  name: 'komodo_get_sync',
  description: 'Get detailed information about a specific resource sync, including its pending changes.',
  schema: z.object({
    sync: z.string().describe(PARAM_DESCRIPTIONS.SYNC_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_get_sync');
    const result = await wrapApiCall(
      'getSync',
      () => komodoClient.syncs.get(args.sync, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(JSON.stringify(result, null, 2));
  },
};

export const createSyncTool: Tool = {
  name: 'komodo_create_sync',
  description: 'Create a new resource sync for GitOps-style infrastructure management.',
  schema: z.object({
    name: z.string().describe(PARAM_DESCRIPTIONS.SYNC_NAME),
    config: z.record(z.unknown()).optional().describe('Resource sync configuration (optional)'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_create_sync');
    const result = await wrapApiCall(
      'createSync',
      () => komodoClient.syncs.create(args.name, args.config as never, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Resource sync "${args.name}" created successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const updateSyncTool: Tool = {
  name: 'komodo_update_sync',
  description: 'Update an existing resource sync configuration (PATCH-style).',
  schema: z.object({
    sync: z.string().describe(PARAM_DESCRIPTIONS.SYNC_ID),
    config: z.record(z.unknown()).describe('Resource sync configuration fields to update'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_update_sync');
    const result = await wrapApiCall(
      'updateSync',
      () => komodoClient.syncs.update(args.sync, args.config as never, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Resource sync "${args.sync}" updated successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const deleteSyncTool: Tool = {
  name: 'komodo_delete_sync',
  description: 'Delete a resource sync.',
  schema: z.object({
    sync: z.string().describe(PARAM_DESCRIPTIONS.SYNC_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_delete_sync');
    const result = await wrapApiCall(
      'deleteSync',
      () => komodoClient.syncs.delete(args.sync, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Resource sync "${args.sync}" deleted successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const runSyncTool: Tool = {
  name: 'komodo_run_sync',
  description: 'Run a resource sync to apply the defined infrastructure from the git source.',
  schema: z.object({
    sync: z.string().describe(PARAM_DESCRIPTIONS.SYNC_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_run_sync');
    const result = await wrapApiCall(
      `run sync '${args.sync}'`,
      () => komodoClient.syncs.run(args.sync, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'sync',
        resourceType: 'sync',
        resourceId: args.sync,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
};

export const commitSyncTool: Tool = {
  name: 'komodo_commit_sync',
  description:
    'Commit the current resource state to the sync target. Exports matching resources and writes to the sync resource file in git.',
  schema: z.object({
    sync: z.string().describe(PARAM_DESCRIPTIONS.SYNC_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_commit_sync');
    const result = await wrapApiCall(
      `commit sync '${args.sync}'`,
      () => komodoClient.syncs.commit(args.sync, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'commit',
        resourceType: 'sync',
        resourceId: args.sync,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
};
