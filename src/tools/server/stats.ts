import { z } from 'zod';
import { Tool } from '../base.js';

export const getServerStatsTool: Tool = {
  name: 'komodo_get_server_stats',
  description: 'Get server statistics and status',
  schema: z.object({
    server: z.string().describe('Server ID or name'),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error('Komodo client not initialized');
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
