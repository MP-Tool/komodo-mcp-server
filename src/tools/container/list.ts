import { z } from 'zod';
import { Tool } from '../base.js';
import { KomodoContainerListItem } from '../../api/index.js';
import { ERROR_MESSAGES, PARAM_DESCRIPTIONS } from '../../config/index.js';

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
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const containers = await client.containers.list(args.server, { signal: abortSignal });
    return {
      content: [
        {
          type: 'text',
          text: `📦 Containers on server "${args.server}":\n\n${
            containers
              .map((c: KomodoContainerListItem) => `• ${c.name} (${c.state}) - ${c.image || 'Unknown Image'}`)
              .join('\n') || 'No containers found.'
          }`,
        },
      ],
    };
  },
};
