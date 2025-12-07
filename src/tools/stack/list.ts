import { z } from 'zod';
import { Tool } from '../base.js';
import { KomodoStackListItem } from '../../api/index.js';

export const listStacksTool: Tool = {
  name: 'komodo_list_stacks',
  description: 'List all Docker Compose stacks',
  schema: z.object({}),
  handler: async (_args, { client }) => {
    if (!client) throw new Error('Komodo client not initialized');
    const stacks = await client.stacks.list();
    return {
      content: [{
        type: 'text',
        text: `📚 Docker Compose stacks:\n\n${stacks.map((s: KomodoStackListItem) => 
          `• ${s.name} (${s.id}) - State: ${s.info.state}`
        ).join('\n') || 'No stacks found.'}`
      }]
    };
  }
};
