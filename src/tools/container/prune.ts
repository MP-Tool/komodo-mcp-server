import { z } from 'zod';
import { Tool } from '../base.js';
import { extractUpdateId } from '../../api/index.js';
import { ERROR_MESSAGES } from '../../config/constants.js';
import { PARAM_DESCRIPTIONS } from '../../config/descriptions.js';
import { pruneTargetSchema } from '../schemas/index.js';

/**
 * Tool to prune unused resources.
 */
export const pruneResourcesTool: Tool = {
  name: 'komodo_prune',
  description:
    'Prune unused resources on a server. This permanently removes stopped containers, unused images, volumes, or networks to free up resources.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
    pruneTarget: pruneTargetSchema,
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
