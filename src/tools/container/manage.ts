import { z } from 'zod';
import { Tool } from '../base.js';
import { extractUpdateId } from '../../api/index.js';
import { ERROR_MESSAGES } from '../../config/constants.js';

const containerActionSchema = z.object({
  server: z.string().describe('Server ID or name'),
  container: z.string().describe('Container name'),
});

/**
 * Tool to start a Docker container.
 */
export const startContainerTool: Tool = {
  name: 'komodo_start_container',
  description: 'Start a Docker container',
  schema: containerActionSchema,
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.containers.start(args.server, args.container);
    return {
      content: [
        {
          type: 'text',
          text: `🚀 Container "${args.container}" started on server "${args.server}".\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`,
        },
      ],
    };
  },
};

/**
 * Tool to stop a Docker container.
 */
export const stopContainerTool: Tool = {
  name: 'komodo_stop_container',
  description: 'Stop a Docker container',
  schema: containerActionSchema,
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.containers.stop(args.server, args.container);
    return {
      content: [
        {
          type: 'text',
          text: `⏹️ Container "${args.container}" stopped on server "${args.server}".\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`,
        },
      ],
    };
  },
};

/**
 * Tool to restart a Docker container.
 */
export const restartContainerTool: Tool = {
  name: 'komodo_restart_container',
  description: 'Restart a Docker container',
  schema: containerActionSchema,
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.containers.restart(args.server, args.container);
    return {
      content: [
        {
          type: 'text',
          text: `🔄 Container "${args.container}" restarted on server "${args.server}".\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`,
        },
      ],
    };
  },
};

/**
 * Tool to pause a Docker container.
 */
export const pauseContainerTool: Tool = {
  name: 'komodo_pause_container',
  description: 'Pause a Docker container',
  schema: containerActionSchema,
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.containers.pause(args.server, args.container);
    return {
      content: [
        {
          type: 'text',
          text: `⏸️ Container "${args.container}" paused on server "${args.server}".\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`,
        },
      ],
    };
  },
};

/**
 * Tool to unpause a Docker container.
 */
export const unpauseContainerTool: Tool = {
  name: 'komodo_unpause_container',
  description: 'Unpause a Docker container',
  schema: containerActionSchema,
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.containers.unpause(args.server, args.container);
    return {
      content: [
        {
          type: 'text',
          text: `▶️ Container "${args.container}" resumed on server "${args.server}".\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`,
        },
      ],
    };
  },
};
