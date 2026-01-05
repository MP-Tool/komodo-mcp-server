import { z } from 'zod';
import { Tool } from '../base.js';
import { extractUpdateId } from '../../api/index.js';
import { ERROR_MESSAGES } from '../../config/constants.js';

/**
 * Tool to prune unused resources.
 */
export const pruneResourcesTool: Tool = {
  name: 'komodo_prune',
  description: 'Prune unused container resources (containers, images, volumes, networks, system)',
  schema: z.object({
    server: z.string().describe('Server ID or name'),
    pruneTarget: z
      .enum(['containers', 'images', 'volumes', 'networks', 'system', 'all'])
      .describe('The type of resource to prune'),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.containers.prune(args.server, args.pruneTarget);
    return {
      content: [
        {
          type: 'text',
          text: `🧹 Pruned ${args.pruneTarget} on server "${args.server}".\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`,
        },
      ],
    };
  },
};
