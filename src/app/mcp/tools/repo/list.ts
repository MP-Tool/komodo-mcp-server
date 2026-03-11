import { z } from 'zod';
import { Tool } from '../base.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

export const listReposTool: Tool = {
  name: 'komodo_list_repos',
  description: 'List all repos managed by Komodo. Repos are git repositories with clone, pull, and build capabilities.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_list_repos');
    const repos = await wrapApiCall(
      'listRepos',
      () => komodoClient.repos.list({ signal: abortSignal }),
      abortSignal,
    );
    const list =
      repos
        .map((r) => `• ${r.name} (${r.id}) - Tags: ${r.tags?.join(', ') || 'none'}`)
        .join('\n') || 'No repos found.';
    return successResponse(`📋 Repos:\n\n${list}`);
  },
};
