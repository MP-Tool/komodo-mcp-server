import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { extractUpdateId } from '../../../api/utils.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';
import { formatActionResponse } from '../../../utils/index.js';

export const getActionTool: Tool = {
  name: 'komodo_get_action',
  description: 'Get detailed information about a specific action, including its script content.',
  schema: z.object({
    action: z.string().describe(PARAM_DESCRIPTIONS.ACTION_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_get_action');
    const result = await wrapApiCall(
      'getAction',
      () => komodoClient.actions.get(args.action, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(JSON.stringify(result, null, 2));
  },
};

export const createActionTool: Tool = {
  name: 'komodo_create_action',
  description: 'Create a new action. Actions are TypeScript scripts that run with a pre-authenticated Komodo client.',
  schema: z.object({
    name: z.string().describe(PARAM_DESCRIPTIONS.ACTION_NAME),
    config: z.record(z.unknown()).optional().describe('Action configuration (optional)'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_create_action');
    const result = await wrapApiCall(
      'createAction',
      () => komodoClient.actions.create(args.name, args.config as never, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Action "${args.name}" created successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const updateActionTool: Tool = {
  name: 'komodo_update_action',
  description: 'Update an existing action configuration (PATCH-style).',
  schema: z.object({
    action: z.string().describe(PARAM_DESCRIPTIONS.ACTION_ID),
    config: z.record(z.unknown()).describe('Action configuration fields to update'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_update_action');
    const result = await wrapApiCall(
      'updateAction',
      () => komodoClient.actions.update(args.action, args.config as never, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Action "${args.action}" updated successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const deleteActionTool: Tool = {
  name: 'komodo_delete_action',
  description: 'Delete an action.',
  schema: z.object({
    action: z.string().describe(PARAM_DESCRIPTIONS.ACTION_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_delete_action');
    const result = await wrapApiCall(
      'deleteAction',
      () => komodoClient.actions.delete(args.action, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Action "${args.action}" deleted successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const runActionTool: Tool = {
  name: 'komodo_run_action',
  description: 'Run an action. Executes the TypeScript script with a pre-authenticated Komodo client.',
  schema: z.object({
    action: z.string().describe(PARAM_DESCRIPTIONS.ACTION_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_run_action');
    const result = await wrapApiCall(
      `run action '${args.action}'`,
      () => komodoClient.actions.run(args.action, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'run',
        resourceType: 'action',
        resourceId: args.action,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
};
