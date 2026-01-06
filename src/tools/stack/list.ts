import { z } from 'zod';
import { Tool } from '../base.js';
import { KomodoStackListItem } from '../../api/index.js';
import { ERROR_MESSAGES } from '../../config/constants.js';

/**
 * Tool to list all Compose stacks.
 */
export const listStacksTool: Tool = {
  name: 'komodo_list_stacks',
  description:
    'List all Komodo-managed Compose stacks. Stacks are multi-container applications defined by compose files. Shows stack name, ID, and current state.',
  schema: z.object({}),
  handler: async (_args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const stacks = await client.stacks.list();
    return {
      content: [
        {
          type: 'text',
          text: `📚 Docker Compose stacks:\n\n${
            stacks.map((s: KomodoStackListItem) => `• ${s.name} (${s.id}) - State: ${s.info.state}`).join('\n') ||
            'No stacks found.'
          }`,
        },
      ],
    };
  },
};
