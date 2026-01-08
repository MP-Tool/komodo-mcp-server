import { z } from 'zod';
import { Tool } from '../base.js';
import { extractUpdateId } from '../../api/utils.js';
import { ERROR_MESSAGES, PARAM_DESCRIPTIONS } from '../../config/index.js';

/**
 * Tool to deploy a Komodo-managed Compose stack.
 */
export const deployStackTool: Tool = {
  name: 'komodo_deploy_stack',
  description:
    'Deploy a Komodo-managed Compose stack. This runs `docker compose up -d` based on the stack configuration.',
  schema: z.object({
    stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
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

/**
 * Tool to pull the latest images for a Komodo stack.
 */
export const pullStackTool: Tool = {
  name: 'komodo_pull_stack',
  description:
    'Pull the latest images for a Komodo-managed Docker Compose stack without redeploying. Runs `docker compose pull`.',
  schema: z.object({
    stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.stacks.pull(args.stack);
    return {
      content: [
        {
          type: 'text',
          text: `📥 Image pull for stack "${args.stack}" initiated.\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`,
        },
      ],
    };
  },
};

/**
 * Tool to start a Komodo-managed Compose stack.
 */
export const startStackTool: Tool = {
  name: 'komodo_start_stack',
  description:
    'Start a stopped Komodo-managed Compose stack. Runs `docker compose start` to resume stopped containers.',
  schema: z.object({
    stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.stacks.start(args.stack);
    return {
      content: [
        {
          type: 'text',
          text: `▶️ Stack "${args.stack}" started.\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`,
        },
      ],
    };
  },
};

/**
 * Tool to restart a Komodo-managed Compose stack.
 */
export const restartStackTool: Tool = {
  name: 'komodo_restart_stack',
  description: 'Restart a Komodo-managed Compose stack. Runs `docker compose restart` to restart all services.',
  schema: z.object({
    stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.stacks.restart(args.stack);
    return {
      content: [
        {
          type: 'text',
          text: `🔄 Stack "${args.stack}" restarted.\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`,
        },
      ],
    };
  },
};

/**
 * Tool to pause a Komodo-managed Compose stack.
 */
export const pauseStackTool: Tool = {
  name: 'komodo_pause_stack',
  description:
    'Pause a running Komodo-managed Compose stack. Runs `docker compose pause` to suspend all container processes.',
  schema: z.object({
    stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.stacks.pause(args.stack);
    return {
      content: [
        {
          type: 'text',
          text: `⏸️ Stack "${args.stack}" paused.\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`,
        },
      ],
    };
  },
};

/**
 * Tool to unpause a Komodo-managed Compose stack.
 */
export const unpauseStackTool: Tool = {
  name: 'komodo_unpause_stack',
  description:
    'Unpause a paused Komodo-managed Compose stack. Runs `docker compose unpause` to resume all container processes.',
  schema: z.object({
    stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.stacks.unpause(args.stack);
    return {
      content: [
        {
          type: 'text',
          text: `▶️ Stack "${args.stack}" unpaused.\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`,
        },
      ],
    };
  },
};

/**
 * Tool to stop a Komodo-managed Compose stack.
 */
export const stopStackTool: Tool = {
  name: 'komodo_stop_stack',
  description:
    'Stop a running Komodo-managed Compose stack. Runs `docker compose stop` to stop all containers without removing them.',
  schema: z.object({
    stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
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
 * Tool to destroy a Komodo-managed Compose stack.
 */
export const destroyStackTool: Tool = {
  name: 'komodo_destroy_stack',
  description:
    'Destroy (remove) all containers of a Komodo-managed Compose stack. Runs `docker compose down`. The stack configuration in Komodo is preserved.',
  schema: z.object({
    stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.stacks.destroy(args.stack);
    return {
      content: [
        {
          type: 'text',
          text: `🗑️ Stack "${args.stack}" destroyed.\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`,
        },
      ],
    };
  },
};
