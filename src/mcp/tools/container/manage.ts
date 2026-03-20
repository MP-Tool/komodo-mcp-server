import { Tool } from '../base.js';
import { extractUpdateId } from '../../../api/index.js';
import { containerActionSchema } from '../schemas/index.js';
import { formatActionResponse } from '../../../utils/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

/**
 * Tool to start a container.
 */
export const startContainerTool: Tool = {
  name: 'komodo_start_container',
  description:
    'Start a stopped or paused container. The container must exist and be in a stopped or paused state. Returns an update ID to track the operation.',
  schema: containerActionSchema,
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_start_container');

    const result = await wrapApiCall(
      'startContainer',
      () => validClient.containers.start(args.server, args.container, { signal: abortSignal }),
      abortSignal,
    );

    return successResponse(
      formatActionResponse({
        action: 'start',
        resourceType: 'container',
        resourceId: args.container,
        serverName: args.server,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
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
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_stop_container');

    const result = await wrapApiCall(
      'stopContainer',
      () => validClient.containers.stop(args.server, args.container, { signal: abortSignal }),
      abortSignal,
    );

    return successResponse(
      formatActionResponse({
        action: 'stop',
        resourceType: 'container',
        resourceId: args.container,
        serverName: args.server,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
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
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_restart_container');

    const result = await wrapApiCall(
      'restartContainer',
      () => validClient.containers.restart(args.server, args.container, { signal: abortSignal }),
      abortSignal,
    );

    return successResponse(
      formatActionResponse({
        action: 'restart',
        resourceType: 'container',
        resourceId: args.container,
        serverName: args.server,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
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
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_pause_container');

    const result = await wrapApiCall(
      'pauseContainer',
      () => validClient.containers.pause(args.server, args.container, { signal: abortSignal }),
      abortSignal,
    );

    return successResponse(
      formatActionResponse({
        action: 'pause',
        resourceType: 'container',
        resourceId: args.container,
        serverName: args.server,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
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
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_unpause_container');

    const result = await wrapApiCall(
      'unpauseContainer',
      () => validClient.containers.unpause(args.server, args.container, { signal: abortSignal }),
      abortSignal,
    );

    return successResponse(
      formatActionResponse({
        action: 'unpause',
        resourceType: 'container',
        resourceId: args.container,
        serverName: args.server,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
};
