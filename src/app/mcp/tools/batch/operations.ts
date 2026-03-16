/**
 * Batch Operations Tools
 *
 * MCP tools for executing batch operations across multiple Komodo resources
 * matching a name pattern.
 *
 * @module tools/batch/operations
 */

import { z } from 'zod';
import { Tool } from '../base.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

const patternSchema = z.object({
  pattern: z
    .string()
    .describe('Resource name pattern to match (supports glob-style matching). Example: "prod-*", "staging-api-*"'),
});

export const batchDeployTool: Tool = {
  name: 'komodo_batch_deploy',
  description:
    'Deploy all deployments matching a name pattern. Useful for rolling out changes across multiple services.',
  schema: patternSchema,
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_batch_deploy');
    const result = await wrapApiCall(
      'batchDeploy',
      () => validClient.batch.batchDeploy(args.pattern, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `Batch deploy triggered for pattern "${args.pattern}":\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const batchDestroyDeploymentTool: Tool = {
  name: 'komodo_batch_destroy_deployment',
  description: 'Destroy all deployments matching a name pattern. WARNING: This removes containers permanently.',
  schema: patternSchema,
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_batch_destroy_deployment');
    const result = await wrapApiCall(
      'batchDestroyDeployment',
      () => validClient.batch.batchDestroyDeployment(args.pattern, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `Batch destroy deployments triggered for pattern "${args.pattern}":\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const batchDeployStackTool: Tool = {
  name: 'komodo_batch_deploy_stack',
  description: 'Deploy all stacks matching a name pattern.',
  schema: patternSchema,
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_batch_deploy_stack');
    const result = await wrapApiCall(
      'batchDeployStack',
      () => validClient.batch.batchDeployStack(args.pattern, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `Batch deploy stacks triggered for pattern "${args.pattern}":\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const batchDestroyStackTool: Tool = {
  name: 'komodo_batch_destroy_stack',
  description: 'Destroy all stacks matching a name pattern. WARNING: This removes stack containers permanently.',
  schema: patternSchema,
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_batch_destroy_stack');
    const result = await wrapApiCall(
      'batchDestroyStack',
      () => validClient.batch.batchDestroyStack(args.pattern, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `Batch destroy stacks triggered for pattern "${args.pattern}":\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const batchPullStackTool: Tool = {
  name: 'komodo_batch_pull_stack',
  description: 'Pull latest images for all stacks matching a name pattern.',
  schema: patternSchema,
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_batch_pull_stack');
    const result = await wrapApiCall(
      'batchPullStack',
      () => validClient.batch.batchPullStack(args.pattern, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `Batch pull stacks triggered for pattern "${args.pattern}":\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const batchRunBuildTool: Tool = {
  name: 'komodo_batch_run_build',
  description: 'Run all builds matching a name pattern.',
  schema: patternSchema,
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_batch_run_build');
    const result = await wrapApiCall(
      'batchRunBuild',
      () => validClient.batch.batchRunBuild(args.pattern, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `Batch run builds triggered for pattern "${args.pattern}":\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const batchCloneRepoTool: Tool = {
  name: 'komodo_batch_clone_repo',
  description: 'Clone all repos matching a name pattern.',
  schema: patternSchema,
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_batch_clone_repo');
    const result = await wrapApiCall(
      'batchCloneRepo',
      () => validClient.batch.batchCloneRepo(args.pattern, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `Batch clone repos triggered for pattern "${args.pattern}":\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const batchPullRepoTool: Tool = {
  name: 'komodo_batch_pull_repo',
  description: 'Pull latest changes for all repos matching a name pattern.',
  schema: patternSchema,
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_batch_pull_repo');
    const result = await wrapApiCall(
      'batchPullRepo',
      () => validClient.batch.batchPullRepo(args.pattern, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `Batch pull repos triggered for pattern "${args.pattern}":\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const batchBuildRepoTool: Tool = {
  name: 'komodo_batch_build_repo',
  description: 'Build all repos matching a name pattern.',
  schema: patternSchema,
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_batch_build_repo');
    const result = await wrapApiCall(
      'batchBuildRepo',
      () => validClient.batch.batchBuildRepo(args.pattern, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `Batch build repos triggered for pattern "${args.pattern}":\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const batchRunActionTool: Tool = {
  name: 'komodo_batch_run_action',
  description: 'Run all actions matching a name pattern.',
  schema: patternSchema,
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_batch_run_action');
    const result = await wrapApiCall(
      'batchRunAction',
      () => validClient.batch.batchRunAction(args.pattern, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `Batch run actions triggered for pattern "${args.pattern}":\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const batchRunProcedureTool: Tool = {
  name: 'komodo_batch_run_procedure',
  description: 'Run all procedures matching a name pattern.',
  schema: patternSchema,
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_batch_run_procedure');
    const result = await wrapApiCall(
      'batchRunProcedure',
      () => validClient.batch.batchRunProcedure(args.pattern, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `Batch run procedures triggered for pattern "${args.pattern}":\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};
