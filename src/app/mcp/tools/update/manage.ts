import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

export const getUpdateTool: Tool = {
  name: 'komodo_get_update',
  description: 'Get detailed information about a specific update (operation log entry).',
  schema: z.object({
    id: z.string().describe(PARAM_DESCRIPTIONS.UPDATE_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_get_update');
    const result = await wrapApiCall(
      'getUpdate',
      () => komodoClient.updates.get(args.id, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(JSON.stringify(result, null, 2));
  },
};

export const getAlertTool: Tool = {
  name: 'komodo_get_alert',
  description: 'Get detailed information about a specific alert.',
  schema: z.object({
    id: z.string().describe('Alert ID'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_get_alert');
    const result = await wrapApiCall(
      'getAlert',
      () => komodoClient.updates.getAlert(args.id, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(JSON.stringify(result, null, 2));
  },
};
