import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

export const getBuilderTool: Tool = {
  name: 'komodo_get_builder',
  description: 'Get detailed information about a specific builder.',
  schema: z.object({
    builder: z.string().describe(PARAM_DESCRIPTIONS.BUILDER_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_get_builder');
    const result = await wrapApiCall(
      'getBuilder',
      () => komodoClient.builders.get(args.builder, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(JSON.stringify(result, null, 2));
  },
};

export const createBuilderTool: Tool = {
  name: 'komodo_create_builder',
  description: 'Create a new builder. Builders define the build environment (e.g., server, AWS) for creating Docker images.',
  schema: z.object({
    name: z.string().describe(PARAM_DESCRIPTIONS.BUILDER_NAME),
    config: z.record(z.unknown()).optional().describe('Builder configuration (optional)'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_create_builder');
    const result = await wrapApiCall(
      'createBuilder',
      () => komodoClient.builders.create(args.name, args.config as never, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Builder "${args.name}" created successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const updateBuilderTool: Tool = {
  name: 'komodo_update_builder',
  description: 'Update an existing builder configuration (PATCH-style).',
  schema: z.object({
    builder: z.string().describe(PARAM_DESCRIPTIONS.BUILDER_ID),
    config: z.record(z.unknown()).describe('Builder configuration fields to update'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_update_builder');
    const result = await wrapApiCall(
      'updateBuilder',
      () => komodoClient.builders.update(args.builder, args.config as never, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Builder "${args.builder}" updated successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const deleteBuilderTool: Tool = {
  name: 'komodo_delete_builder',
  description: 'Delete a builder.',
  schema: z.object({
    builder: z.string().describe(PARAM_DESCRIPTIONS.BUILDER_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_delete_builder');
    const result = await wrapApiCall(
      'deleteBuilder',
      () => komodoClient.builders.delete(args.builder, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Builder "${args.builder}" deleted successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};
