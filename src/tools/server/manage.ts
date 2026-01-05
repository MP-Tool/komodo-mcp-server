import { z } from 'zod';
import { Tool } from '../base.js';
import { ERROR_MESSAGES } from '../../config/constants.js';

/**
 * Tool to get detailed information about a server.
 */
export const getServerInfoTool: Tool = {
  name: 'komodo_get_server_info',
  description: 'Get detailed information about a specific server',
  schema: z.object({
    server: z.string().describe('Server ID or name'),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.servers.get(args.server);
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
 * Tool to create a new server.
 */
export const createServerTool: Tool = {
  name: 'komodo_create_server',
  description: 'Register a new server in Komodo',
  schema: z.object({
    name: z.string().describe('Name of the server'),
    address: z.string().optional().describe('Address of the server (e.g., http://1.2.3.4:8120)'),
    config: z.record(z.any()).optional().describe('Additional server configuration'),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);

    // Build the config object with address if provided
    const serverConfig: Record<string, unknown> = {
      ...args.config,
    };
    if (args.address) {
      serverConfig.address = args.address;
    }

    const result = await client.servers.create(args.name, serverConfig);
    return {
      content: [
        {
          type: 'text',
          text: `Server "${args.name}" created successfully.\n\nServer Name: ${result.name}\n\nFull Result:\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  },
};

/**
 * Tool to update a server.
 */
export const updateServerTool: Tool = {
  name: 'komodo_update_server',
  description: 'Update an existing server configuration',
  schema: z.object({
    server: z.string().describe('Server ID or name'),
    config: z.record(z.any()).describe('New server configuration'),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.servers.update(args.server, args.config);
    return {
      content: [
        {
          type: 'text',
          text: `Server "${args.server}" updated successfully.\n\nResult: ${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  },
};

/**
 * Tool to delete a server.
 */
export const deleteServerTool: Tool = {
  name: 'komodo_delete_server',
  description: 'Delete (unregister) a server',
  schema: z.object({
    server: z.string().describe('Server ID or name'),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.servers.delete(args.server);
    return {
      content: [
        {
          type: 'text',
          text: `Server "${args.server}" deleted successfully.\n\nDeleted Server:\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  },
};
