import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { extractUpdateId } from '../../../api/utils.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';
import { formatActionResponse } from '../../../utils/index.js';

export const getBuildTool: Tool = {
  name: 'komodo_get_build',
  description: 'Get detailed information about a specific build, including its configuration and version history.',
  schema: z.object({
    build: z.string().describe(PARAM_DESCRIPTIONS.BUILD_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_get_build');
    const result = await wrapApiCall(
      'getBuild',
      () => komodoClient.builds.get(args.build, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(JSON.stringify(result, null, 2));
  },
};

export const createBuildTool: Tool = {
  name: 'komodo_create_build',
  description: 'Create a new build configuration for building Docker images from a git repository.',
  schema: z.object({
    name: z.string().describe(PARAM_DESCRIPTIONS.BUILD_NAME),
    config: z.record(z.unknown()).optional().describe('Build configuration (optional)'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_create_build');
    const result = await wrapApiCall(
      'createBuild',
      () => komodoClient.builds.create(args.name, args.config as never, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Build "${args.name}" created successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const updateBuildTool: Tool = {
  name: 'komodo_update_build',
  description: 'Update an existing build configuration (PATCH-style).',
  schema: z.object({
    build: z.string().describe(PARAM_DESCRIPTIONS.BUILD_ID),
    config: z.record(z.unknown()).describe('Build configuration fields to update'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_update_build');
    const result = await wrapApiCall(
      'updateBuild',
      () => komodoClient.builds.update(args.build, args.config as never, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Build "${args.build}" updated successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const deleteBuildTool: Tool = {
  name: 'komodo_delete_build',
  description: 'Delete a build configuration.',
  schema: z.object({
    build: z.string().describe(PARAM_DESCRIPTIONS.BUILD_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_delete_build');
    const result = await wrapApiCall(
      'deleteBuild',
      () => komodoClient.builds.delete(args.build, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Build "${args.build}" deleted successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const runBuildTool: Tool = {
  name: 'komodo_run_build',
  description: 'Run a build to create a Docker image from the configured git repository and Dockerfile.',
  schema: z.object({
    build: z.string().describe(PARAM_DESCRIPTIONS.BUILD_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_run_build');
    const result = await wrapApiCall(
      `run build '${args.build}'`,
      () => komodoClient.builds.run(args.build, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'build',
        resourceType: 'build',
        resourceId: args.build,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
};

export const cancelBuildTool: Tool = {
  name: 'komodo_cancel_build',
  description: 'Cancel a running build. Only effective if the build is currently in progress.',
  schema: z.object({
    build: z.string().describe(PARAM_DESCRIPTIONS.BUILD_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_cancel_build');
    const result = await wrapApiCall(
      `cancel build '${args.build}'`,
      () => komodoClient.builds.cancel(args.build, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'cancel',
        resourceType: 'build',
        resourceId: args.build,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
};
