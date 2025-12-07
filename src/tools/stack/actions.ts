import { z } from 'zod';
import { Tool } from '../base.js';
import { extractUpdateId } from '../../api/utils.js';

/**
 * Tool to stop a Docker Compose stack.
 */
export const stopStackTool: Tool = {
  name: 'komodo_stop_stack',
  description: 'Stop a Docker Compose stack',
  schema: z.object({
    stack: z.string().describe('Stack ID or name'),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error('Komodo client not initialized');
    const result = await client.stacks.stop(args.stack);
    return {
      content: [
        {
          type: 'text',
          text: `⏹️ Stack "${args.stack}" stopped.\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`,
        },
      ],
    };
  },
};

/**
 * Tool to deploy a Docker Compose stack.
 */
export const deployStackTool: Tool = {
  name: 'komodo_deploy_stack',
  description: 'Deploy a Docker Compose stack',
  schema: z.object({
    stack: z.string().describe('Stack ID or name'),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error('Komodo client not initialized');
    const result = await client.stacks.deploy(args.stack);
    return {
      content: [
        {
          type: 'text',
          text: `🚀 Stack "${args.stack}" deployed.\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`,
        },
      ],
    };
  },
};
