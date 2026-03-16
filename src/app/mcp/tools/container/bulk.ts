/**
 * Bulk Container Operations Tools
 *
 * MCP tools for bulk lifecycle operations on all containers on a server,
 * destroying individual containers, and pruning Docker builder caches.
 *
 * @module tools/container/bulk
 */

import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

const serverOnlySchema = z.object({
  server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
});

export const startAllContainersTool: Tool = {
  name: 'komodo_start_all_containers',
  description: 'Start all stopped containers on a server.',
  schema: serverOnlySchema,
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_start_all_containers');
    const result = await wrapApiCall(
      'startAllContainers',
      () => validClient.bulkContainers.startAll(args.server, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`All containers started on server "${args.server}".\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const restartAllContainersTool: Tool = {
  name: 'komodo_restart_all_containers',
  description: 'Restart all containers on a server.',
  schema: serverOnlySchema,
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_restart_all_containers');
    const result = await wrapApiCall(
      'restartAllContainers',
      () => validClient.bulkContainers.restartAll(args.server, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `All containers restarted on server "${args.server}".\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const pauseAllContainersTool: Tool = {
  name: 'komodo_pause_all_containers',
  description: 'Pause all running containers on a server.',
  schema: serverOnlySchema,
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_pause_all_containers');
    const result = await wrapApiCall(
      'pauseAllContainers',
      () => validClient.bulkContainers.pauseAll(args.server, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`All containers paused on server "${args.server}".\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const unpauseAllContainersTool: Tool = {
  name: 'komodo_unpause_all_containers',
  description: 'Unpause all paused containers on a server.',
  schema: serverOnlySchema,
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_unpause_all_containers');
    const result = await wrapApiCall(
      'unpauseAllContainers',
      () => validClient.bulkContainers.unpauseAll(args.server, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`All containers unpaused on server "${args.server}".\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const stopAllContainersTool: Tool = {
  name: 'komodo_stop_all_containers',
  description: 'Stop all running containers on a server. WARNING: This will stop ALL containers.',
  schema: serverOnlySchema,
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_stop_all_containers');
    const result = await wrapApiCall(
      'stopAllContainers',
      () => validClient.bulkContainers.stopAll(args.server, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`All containers stopped on server "${args.server}".\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const destroyContainerTool: Tool = {
  name: 'komodo_destroy_container',
  description: 'Destroy (remove) a container from a server permanently. The container will be stopped and deleted.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID_WHERE_CONTAINER_RUNS),
    container: z.string().describe(PARAM_DESCRIPTIONS.CONTAINER_ID_FOR_ACTION),
    signal: z.string().optional().describe('Signal to send before removing (e.g., "SIGTERM", "SIGKILL")'),
    time: z.number().optional().describe('Seconds to wait for graceful stop before killing'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_destroy_container');
    const result = await wrapApiCall(
      'destroyContainer',
      () =>
        validClient.bulkContainers.destroy(args.server, args.container, args.signal, args.time, {
          signal: abortSignal,
        }),
      abortSignal,
    );
    return successResponse(
      `Container "${args.container}" destroyed on server "${args.server}".\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const pruneDockerBuildersTool: Tool = {
  name: 'komodo_prune_docker_builders',
  description: 'Prune Docker builder cache on a server to free disk space.',
  schema: serverOnlySchema,
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_prune_docker_builders');
    const result = await wrapApiCall(
      'pruneDockerBuilders',
      () => validClient.bulkContainers.pruneBuilders(args.server, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Docker builders pruned on server "${args.server}".\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const pruneBuildxTool: Tool = {
  name: 'komodo_prune_buildx',
  description: 'Prune Docker Buildx cache on a server.',
  schema: serverOnlySchema,
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_prune_buildx');
    const result = await wrapApiCall(
      'pruneBuildx',
      () => validClient.bulkContainers.pruneBuildx(args.server, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Buildx cache pruned on server "${args.server}".\n\n${JSON.stringify(result, null, 2)}`);
  },
};
