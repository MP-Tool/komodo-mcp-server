import { z } from 'zod';
import { Tool } from '../base.js';
import { ERROR_MESSAGES } from '../../config/constants.js';
import { PARAM_DESCRIPTIONS } from '../../config/descriptions.js';

/**
 * Tool to get statistics and status for a specific server.
 */
export const getServerStatsTool: Tool = {
  name: 'komodo_get_server_stats',
  description:
    'Get server health status and state. Returns whether the Periphery agent is reachable and the server is healthy. For detailed system metrics (CPU, memory, disk), use komodo_get_server_info.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID_FOR_STATS),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stats = (await client.servers.getState(args.server)) as any;
    return {
      content: [
        {
          type: 'text',
          text: `📊 Server "${args.server}" status:\n\n` + `• Status: ${stats.status}`,
        },
      ],
    };
  },
};
