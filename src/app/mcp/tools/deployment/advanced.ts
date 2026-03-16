import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS, LOG_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

export const getDeploymentLogTool: Tool = {
  name: 'komodo_get_deployment_log',
  description:
    "Get logs from a deployment's container. More convenient than container logs since you don't need to know the server or container name.",
  schema: z.object({
    deployment: z.string().describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID),
    tail: z.number().optional().describe(LOG_DESCRIPTIONS.TAIL_LINES(100)),
    timestamps: z.boolean().optional().describe(LOG_DESCRIPTIONS.TIMESTAMPS(false)),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_deployment_log');
    const result = await wrapApiCall(
      'getDeploymentLog',
      () => validClient.deploymentAdvanced.getLog(args.deployment, args.tail, args.timestamps, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`📋 Logs for deployment "${args.deployment}":\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const searchDeploymentLogTool: Tool = {
  name: 'komodo_search_deployment_log',
  description: "Search a deployment's container logs for specific terms.",
  schema: z.object({
    deployment: z.string().describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID),
    terms: z.array(z.string()).describe('Search terms to look for in logs'),
    combinator: z.enum(['And', 'Or']).optional().describe('How to combine search terms. Default: "Or"'),
    invert: z.boolean().optional().describe('Invert search to show non-matching lines'),
    timestamps: z.boolean().optional().describe(LOG_DESCRIPTIONS.TIMESTAMPS(false)),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_search_deployment_log');
    const result = await wrapApiCall(
      'searchDeploymentLog',
      () =>
        validClient.deploymentAdvanced.searchLog(
          args.deployment,
          args.terms,
          args.combinator,
          args.invert,
          args.timestamps,
          { signal: abortSignal },
        ),
      abortSignal,
    );
    return successResponse(
      `🔍 Search results for deployment "${args.deployment}":\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const getDeploymentStatsTool: Tool = {
  name: 'komodo_get_deployment_stats',
  description: "Get resource statistics (CPU, memory, network I/O) for a deployment's container.",
  schema: z.object({
    deployment: z.string().describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_deployment_stats');
    const result = await wrapApiCall(
      'getDeploymentStats',
      () => validClient.deploymentAdvanced.getStats(args.deployment, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`📊 Stats for deployment "${args.deployment}":\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const getDeploymentContainerTool: Tool = {
  name: 'komodo_get_deployment_container',
  description: 'Get the container info for a deployment, showing its current state, image, and server.',
  schema: z.object({
    deployment: z.string().describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_deployment_container');
    const result = await wrapApiCall(
      'getDeploymentContainer',
      () => validClient.deploymentAdvanced.getContainer(args.deployment, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`📦 Container for deployment "${args.deployment}":\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const inspectDeploymentContainerTool: Tool = {
  name: 'komodo_inspect_deployment_container',
  description:
    "Full Docker inspect of a deployment's container. Shows all container details including config, networking, mounts, and state.",
  schema: z.object({
    deployment: z.string().describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_inspect_deployment_container');
    const result = await wrapApiCall(
      'inspectDeploymentContainer',
      () => validClient.deploymentAdvanced.inspectContainer(args.deployment, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `🔍 Inspect deployment "${args.deployment}" container:\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};
