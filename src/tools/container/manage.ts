import { Tool } from '../base.js';
import { extractUpdateId } from '../../api/index.js';
import { ERROR_MESSAGES } from '../../config/index.js';
import { containerActionSchema } from '../schemas/index.js';

/**
 * Tool to start a container.
 */
export const startContainerTool: Tool = {
  name: 'komodo_start_container',
  description:
    'Start a stopped or paused container. The container must exist and be in a stopped or paused state. Returns an update ID to track the operation.',
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
 * Tool to stop a container.
 */
export const stopContainerTool: Tool = {
  name: 'komodo_stop_container',
  description:
    'Stop a running container gracefully. Sends SIGTERM first, then SIGKILL after timeout. Returns an update ID to track the operation.',
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
 * Tool to restart a container.
 */
export const restartContainerTool: Tool = {
  name: 'komodo_restart_container',
  description:
    'Restart a container. Stops the container if running, then starts it again. Useful for applying configuration changes.',
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
 * Tool to pause a container.
 */
export const pauseContainerTool: Tool = {
  name: 'komodo_pause_container',
  description:
    'Pause all processes in a running container using cgroups freezer. The container remains in memory but consumes no CPU cycles.',
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
 * Tool to unpause a container.
 *
 * Note: This is different from start - unpause resumes a PAUSED container,
 * while start boots a STOPPED container. Paused containers keep their state in memory.
 */
export const unpauseContainerTool: Tool = {
  name: 'komodo_unpause_container',
  description: 'Resume a paused container. All processes that were frozen will continue execution.',
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
