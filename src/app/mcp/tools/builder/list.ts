import { z } from 'zod';
import { Tool } from '../base.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

export const listBuildersTool: Tool = {
  name: 'komodo_list_builders',
  description:
    'List all builders in Komodo. Builders are build environments used by Builds to create Docker images.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_list_builders');
    const builders = await wrapApiCall(
      'listBuilders',
      () => komodoClient.builders.list({ signal: abortSignal }),
      abortSignal,
    );
    const list =
      builders
        .map((b) => `• ${b.name} (${b.id}) - Tags: ${b.tags?.join(', ') || 'none'}`)
        .join('\n') || 'No builders found.';
    return successResponse(`📋 Builders:\n\n${list}`);
  },
};
