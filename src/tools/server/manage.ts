import { z } from 'zod';
import { Tool } from '../base.js';
import { ERROR_MESSAGES, PARAM_DESCRIPTIONS, CONFIG_DESCRIPTIONS } from '../../config/index.js';
import { serverConfigSchema } from '../schemas/index.js';

/**
 * Tool to get detailed information about a server.
 */
export const getServerInfoTool: Tool = {
  name: 'komodo_get_server_info',
  description: 'Get detailed information about a specific server',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.servers.get(args.server, { signal: abortSignal });
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
  description:
    'Register a new server in Komodo. The server must have Periphery agent running. Provide the address for Core -> Periphery connections.',
  schema: z.object({
    name: z.string().describe(PARAM_DESCRIPTIONS.SERVER_NAME),
    config: serverConfigSchema.partial().optional().describe(CONFIG_DESCRIPTIONS.SERVER_CONFIG_CREATE),
  }),
  handler: async (args, { client, abortSignal }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);

    const result = await client.servers.create(args.name, args.config || {}, { signal: abortSignal });
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
  description:
    'Update an existing server configuration (PATCH-style: only provided fields are updated, others remain unchanged). Use this to change connection settings, alert thresholds, monitoring options, or maintenance windows.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
    config: serverConfigSchema.partial().describe(CONFIG_DESCRIPTIONS.SERVER_CONFIG_PARTIAL),
  }),
  handler: async (args, { client, abortSignal }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.servers.update(args.server, args.config, { signal: abortSignal });
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
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.servers.delete(args.server, { signal: abortSignal });
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
