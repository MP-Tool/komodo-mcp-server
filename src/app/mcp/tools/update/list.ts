import { z } from 'zod';
import { Tool } from '../base.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

export const listUpdatesTool: Tool = {
  name: 'komodo_list_updates',
  description: 'List recent updates (operation logs) in Komodo. Updates track the status of executed operations.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_list_updates');
    const updates = await wrapApiCall(
      'listUpdates',
      () => komodoClient.updates.list({}, { signal: abortSignal }),
      abortSignal,
    );
    if (!updates || (updates as unknown[]).length === 0) {
      return successResponse('No updates found.');
    }
    return successResponse(`📋 Recent Updates:\n\n${JSON.stringify(updates, null, 2)}`);
  },
};

export const listAlertsTool: Tool = {
  name: 'komodo_list_alerts',
  description: 'List recent alerts in Komodo. Alerts are system notifications about resource state changes.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_list_alerts');
    const alerts = await wrapApiCall(
      'listAlerts',
      () => komodoClient.updates.listAlerts({}, { signal: abortSignal }),
      abortSignal,
    );
    if (!alerts || (alerts as unknown[]).length === 0) {
      return successResponse('No alerts found.');
    }
    return successResponse(`📋 Recent Alerts:\n\n${JSON.stringify(alerts, null, 2)}`);
  },
};
