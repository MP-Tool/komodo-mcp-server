import { z } from 'zod';
import { Tool } from '../base.js';
import { KomodoContainerListItem } from '../../api/index.js';

export const listContainersTool: Tool = {
  name: 'komodo_list_containers',
  description: 'List all Docker containers on a server',
  schema: z.object({
    server: z.string().describe('Server ID or name')
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error('Komodo client not initialized');
    const containers = await client.containers.list(args.server);
    return {
      content: [{
        type: 'text',
        text: `📦 Containers on server "${args.server}":\n\n${containers.map((c: KomodoContainerListItem) => 
          `• ${c.name} (${c.state}) - ${c.image || 'Unknown Image'}`
        ).join('\n') || 'No containers found.'}`
      }]
    };
  }
};
