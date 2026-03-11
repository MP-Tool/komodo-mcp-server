import { z } from 'zod';
import { Tool } from '../base.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

export const listSyncsTool: Tool = {
  name: 'komodo_list_syncs',
  description:
    'List all resource syncs in Komodo. Resource syncs enable GitOps: define infrastructure as TOML in git, and Komodo auto-syncs.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_list_syncs');
    const syncs = await wrapApiCall('listSyncs', () => komodoClient.syncs.list({ signal: abortSignal }), abortSignal);
    const list =
      syncs.map((s) => `• ${s.name} (${s.id}) - Tags: ${s.tags?.join(', ') || 'none'}`).join('\n') ||
      'No resource syncs found.';
    return successResponse(`📋 Resource Syncs:\n\n${list}`);
  },
};
