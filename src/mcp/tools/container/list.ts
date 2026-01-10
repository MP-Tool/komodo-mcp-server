import { z } from 'zod';
import { Tool } from '../base.js';
import { KomodoContainerListItem } from '../../../api/index.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

/**
 * Tool to list all Docker containers on a server.
 */
export const listContainersTool: Tool = {
  name: 'komodo_list_containers',
  description:
    'List all containers on a server, including running, stopped, and paused containers. Shows container name, state, and image.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID_TO_LIST_CONTAINERS),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_containers');

    const containers = await wrapApiCall(
      'listContainers',
      () => validClient.containers.list(args.server, { signal: abortSignal }),
      abortSignal,
    );

    const containerList =
      containers
        .map((c: KomodoContainerListItem) => `• ${c.name} (${c.state}) - ${c.image || 'Unknown Image'}`)
        .join('\n') || 'No containers found.';

    return successResponse(`📦 Containers on server "${args.server}":\n\n${containerList}`);
  },
};
