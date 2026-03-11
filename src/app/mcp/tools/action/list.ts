import { z } from 'zod';
import { Tool } from '../base.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

export const listActionsTool: Tool = {
  name: 'komodo_list_actions',
  description:
    'List all actions in Komodo. Actions are custom TypeScript scripts that run with a pre-authenticated Komodo client.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_list_actions');
    const actions = await wrapApiCall(
      'listActions',
      () => komodoClient.actions.list({ signal: abortSignal }),
      abortSignal,
    );
    const list =
      actions.map((a) => `• ${a.name} (${a.id}) - Tags: ${a.tags?.join(', ') || 'none'}`).join('\n') ||
      'No actions found.';
    return successResponse(`📋 Actions:\n\n${list}`);
  },
};
