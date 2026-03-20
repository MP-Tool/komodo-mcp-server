import { z } from 'zod';
import { Tool } from '../base.js';
import { Types } from '../../../api/index.js';
import { requireClient, wrapApiCall } from '../utils.js';

type StackListItem = Types.StackListItem;

/**
 * Tool to list all Compose stacks.
 */
export const listStacksTool: Tool = {
  name: 'komodo_list_stacks',
  description:
    'List all Komodo-managed Compose stacks. Stacks are multi-container applications defined by compose files. Shows stack name, ID, and current state.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_list_stacks');
    const stacks = await wrapApiCall(
      'list stacks',
      () => komodoClient.stacks.list({ signal: abortSignal }),
      abortSignal,
    );
    return {
      content: [
        {
          type: 'text',
          text: `📚 Docker Compose stacks:\n\n${
            stacks.map((s: StackListItem) => `• ${s.name} (${s.id}) - State: ${s.info.state}`).join('\n') ||
            'No stacks found.'
          }`,
        },
      ],
    };
  },
};
