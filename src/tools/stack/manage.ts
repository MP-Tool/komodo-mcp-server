import { z } from 'zod';
import { Tool } from '../base.js';
import { extractUpdateId } from '../../api/index.js';
import { ERROR_MESSAGES } from '../../config/constants.js';

/**
 * Tool to get detailed information about a stack.
 */
export const getStackInfoTool: Tool = {
  name: 'komodo_get_stack_info',
  description: 'Get detailed information about a specific stack',
  schema: z.object({
    stack: z.string().describe('Stack ID or name'),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.stacks.get(args.stack);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
};

/**
 * Tool to create a new stack.
 */
export const createStackTool: Tool = {
  name: 'komodo_create_stack',
  description: 'Create a new Docker Compose stack',
  schema: z.object({
    name: z.string().describe('Name of the stack'),
    server_id: z.string().optional().describe('ID of the server to deploy to'),
    config: z.record(z.any()).optional().describe('Stack configuration (compose file content, env vars, etc.)'),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);

    // Build the config object
    const stackConfig: Record<string, unknown> = {
      ...args.config,
    };
    if (args.server_id) {
      stackConfig.server_id = args.server_id;
    }

    const result = await client.stacks.create(args.name, stackConfig);
    return {
      content: [
        {
          type: 'text',
          text: `Stack "${args.name}" created successfully.\n\nStack Name: ${result.name}\n\nFull Result:\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  },
};

/**
 * Tool to update a stack.
 */
export const updateStackTool: Tool = {
  name: 'komodo_update_stack',
  description: 'Update an existing stack configuration',
  schema: z.object({
    stack: z.string().describe('Stack ID or name'),
    config: z.record(z.any()).describe('New stack configuration'),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.stacks.update(args.stack, args.config);
    return {
      content: [
        {
          type: 'text',
          text: `Stack "${args.stack}" updated successfully.\n\nResult: ${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  },
};

/**
 * Tool to delete a stack.
 */
export const deleteStackTool: Tool = {
  name: 'komodo_delete_stack',
  description: 'Delete a stack',
  schema: z.object({
    stack: z.string().describe('Stack ID or name'),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.stacks.delete(args.stack);
    return {
      content: [
        {
          type: 'text',
          text: `Stack "${args.stack}" deleted successfully.\n\nDeleted Stack:\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  },
};
