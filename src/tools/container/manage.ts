import { z } from 'zod';
import { Tool } from '../base.js';
import { extractUpdateId } from '../../api/komodo-client.js';

const containerActionSchema = z.object({
  server: z.string().describe('Server ID or name'),
  container: z.string().describe('Container name')
});

export const startContainerTool: Tool = {
  name: 'komodo_start_container',
  description: 'Start a Docker container',
  schema: containerActionSchema,
  handler: async (args, { client }) => {
    if (!client) throw new Error('Komodo client not initialized');
    const result = await client.startContainer(args.server, args.container);
    return {
      content: [{
        type: 'text',
        text: `🚀 Container "${args.container}" started on server "${args.server}".\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`
      }]
    };
  }
};

export const stopContainerTool: Tool = {
  name: 'komodo_stop_container',
  description: 'Stop a Docker container',
  schema: containerActionSchema,
  handler: async (args, { client }) => {
    if (!client) throw new Error('Komodo client not initialized');
    const result = await client.stopContainer(args.server, args.container);
    return {
      content: [{
        type: 'text',
        text: `⏹️ Container "${args.container}" stopped on server "${args.server}".\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`
      }]
    };
  }
};

export const restartContainerTool: Tool = {
  name: 'komodo_restart_container',
  description: 'Restart a Docker container',
  schema: containerActionSchema,
  handler: async (args, { client }) => {
    if (!client) throw new Error('Komodo client not initialized');
    const result = await client.restartContainer(args.server, args.container);
    return {
      content: [{
        type: 'text',
        text: `🔄 Container "${args.container}" restarted on server "${args.server}".\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`
      }]
    };
  }
};

export const pauseContainerTool: Tool = {
  name: 'komodo_pause_container',
  description: 'Pause a Docker container',
  schema: containerActionSchema,
  handler: async (args, { client }) => {
    if (!client) throw new Error('Komodo client not initialized');
    const result = await client.pauseContainer(args.server, args.container);
    return {
      content: [{
        type: 'text',
        text: `⏸️ Container "${args.container}" paused on server "${args.server}".\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`
      }]
    };
  }
};

export const unpauseContainerTool: Tool = {
  name: 'komodo_unpause_container',
  description: 'Unpause a Docker container',
  schema: containerActionSchema,
  handler: async (args, { client }) => {
    if (!client) throw new Error('Komodo client not initialized');
    const result = await client.unpauseContainer(args.server, args.container);
    return {
      content: [{
        type: 'text',
        text: `▶️ Container "${args.container}" resumed on server "${args.server}".\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`
      }]
    };
  }
};
