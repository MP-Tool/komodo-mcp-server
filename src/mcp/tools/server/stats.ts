import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall } from '../utils.js';

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
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_get_server_stats');
    const stats = await wrapApiCall(
      `get stats for server '${args.server}'`,
      () => komodoClient.servers.getState(args.server, { signal: abortSignal }),
      abortSignal,
    );
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
