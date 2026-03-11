import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { extractUpdateId } from '../../../api/utils.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';
import { formatActionResponse } from '../../../utils/index.js';

export const getAlerterTool: Tool = {
  name: 'komodo_get_alerter',
  description: 'Get detailed information about a specific alerter.',
  schema: z.object({
    alerter: z.string().describe(PARAM_DESCRIPTIONS.ALERTER_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_get_alerter');
    const result = await wrapApiCall(
      'getAlerter',
      () => komodoClient.alerters.get(args.alerter, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(JSON.stringify(result, null, 2));
  },
};

export const createAlerterTool: Tool = {
  name: 'komodo_create_alerter',
  description:
    'Create a new alerter for notification routing. Supports Slack, Discord, ntfy, Gotify, Pushover, and custom webhooks.',
  schema: z.object({
    name: z.string().describe(PARAM_DESCRIPTIONS.ALERTER_NAME),
    config: z.record(z.unknown()).optional().describe('Alerter configuration (optional)'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_create_alerter');
    const result = await wrapApiCall(
      'createAlerter',
      () => komodoClient.alerters.create(args.name, args.config as never, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Alerter "${args.name}" created successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const updateAlerterTool: Tool = {
  name: 'komodo_update_alerter',
  description: 'Update an existing alerter configuration (PATCH-style).',
  schema: z.object({
    alerter: z.string().describe(PARAM_DESCRIPTIONS.ALERTER_ID),
    config: z.record(z.unknown()).describe('Alerter configuration fields to update'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_update_alerter');
    const result = await wrapApiCall(
      'updateAlerter',
      () => komodoClient.alerters.update(args.alerter, args.config as never, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Alerter "${args.alerter}" updated successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const deleteAlerterTool: Tool = {
  name: 'komodo_delete_alerter',
  description: 'Delete an alerter.',
  schema: z.object({
    alerter: z.string().describe(PARAM_DESCRIPTIONS.ALERTER_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_delete_alerter');
    const result = await wrapApiCall(
      'deleteAlerter',
      () => komodoClient.alerters.delete(args.alerter, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Alerter "${args.alerter}" deleted successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const testAlerterTool: Tool = {
  name: 'komodo_test_alerter',
  description: 'Test an alerter to verify it can reach the configured notification endpoint.',
  schema: z.object({
    alerter: z.string().describe(PARAM_DESCRIPTIONS.ALERTER_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_test_alerter');
    const result = await wrapApiCall(
      `test alerter '${args.alerter}'`,
      () => komodoClient.alerters.test(args.alerter, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'test',
        resourceType: 'alerter',
        resourceId: args.alerter,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
};
