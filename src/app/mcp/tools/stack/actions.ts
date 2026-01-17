import { z } from 'zod';
import { Tool } from '../base.js';
import { extractUpdateId } from '../../../api/utils.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { formatActionResponse } from '../../../utils/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

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
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_deploy_stack');
    const result = await wrapApiCall(
      `deploy stack '${args.stack}'`,
      () => komodoClient.stacks.deploy(args.stack, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'deploy',
        resourceType: 'stack',
        resourceId: args.stack,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
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
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_pull_stack');
    const result = await wrapApiCall(
      `pull images for stack '${args.stack}'`,
      () => komodoClient.stacks.pull(args.stack, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'pull',
        resourceType: 'stack',
        resourceId: args.stack,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
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
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_start_stack');
    const result = await wrapApiCall(
      `start stack '${args.stack}'`,
      () => komodoClient.stacks.start(args.stack, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'start',
        resourceType: 'stack',
        resourceId: args.stack,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
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
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_restart_stack');
    const result = await wrapApiCall(
      `restart stack '${args.stack}'`,
      () => komodoClient.stacks.restart(args.stack, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'restart',
        resourceType: 'stack',
        resourceId: args.stack,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
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
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_pause_stack');
    const result = await wrapApiCall(
      `pause stack '${args.stack}'`,
      () => komodoClient.stacks.pause(args.stack, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'pause',
        resourceType: 'stack',
        resourceId: args.stack,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
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
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_unpause_stack');
    const result = await wrapApiCall(
      `unpause stack '${args.stack}'`,
      () => komodoClient.stacks.unpause(args.stack, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'unpause',
        resourceType: 'stack',
        resourceId: args.stack,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
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
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_stop_stack');
    const result = await wrapApiCall(
      `stop stack '${args.stack}'`,
      () => komodoClient.stacks.stop(args.stack, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'stop',
        resourceType: 'stack',
        resourceId: args.stack,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
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
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_destroy_stack');
    const result = await wrapApiCall(
      `destroy stack '${args.stack}'`,
      () => komodoClient.stacks.destroy(args.stack, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'destroy',
        resourceType: 'stack',
        resourceId: args.stack,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
};
