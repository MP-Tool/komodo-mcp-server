import { z } from 'zod';
import { Tool } from '../base.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

export const listAlertersTool: Tool = {
  name: 'komodo_list_alerters',
  description:
    'List all alerters in Komodo. Alerters handle notification routing to Slack, Discord, ntfy, Gotify, custom webhooks, and more.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_list_alerters');
    const alerters = await wrapApiCall(
      'listAlerters',
      () => komodoClient.alerters.list({ signal: abortSignal }),
      abortSignal,
    );
    const list =
      alerters
        .map((a) => `• ${a.name} (${a.id}) - Tags: ${a.tags?.join(', ') || 'none'}`)
        .join('\n') || 'No alerters found.';
    return successResponse(`📋 Alerters:\n\n${list}`);
  },
};
