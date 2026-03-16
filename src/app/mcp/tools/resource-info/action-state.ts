/**
 * Action State Tools
 *
 * Tools for querying the current action state of Komodo resources.
 * Action state indicates what operation (if any) is currently running
 * on a resource (e.g., deploying, building, syncing).
 *
 * @module tools/resource-info/action-state
 */

import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

/**
 * Tool to get the action state of a server.
 */
export const getServerActionStateTool: Tool = {
  name: 'komodo_get_server_action_state',
  description: 'Get the current action state of a server. Shows if any operation is currently running on the server.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_server_action_state');
    const result = await wrapApiCall(
      'getServerActionState',
      () => validClient.resourceInfo.getActionState('Server', args.server, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Server "${args.server}" action state:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to get the action state of a deployment.
 */
export const getDeploymentActionStateTool: Tool = {
  name: 'komodo_get_deployment_action_state',
  description:
    'Get the current action state of a deployment. Shows if any operation (deploy, start, stop, etc.) is currently running.',
  schema: z.object({
    deployment: z.string().describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_deployment_action_state');
    const result = await wrapApiCall(
      'getDeploymentActionState',
      () => validClient.resourceInfo.getActionState('Deployment', args.deployment, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Deployment "${args.deployment}" action state:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to get the action state of a stack.
 */
export const getStackActionStateTool: Tool = {
  name: 'komodo_get_stack_action_state',
  description:
    'Get the current action state of a stack. Shows if any operation (deploy, start, stop, etc.) is currently running.',
  schema: z.object({
    stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_stack_action_state');
    const result = await wrapApiCall(
      'getStackActionState',
      () => validClient.resourceInfo.getActionState('Stack', args.stack, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Stack "${args.stack}" action state:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to get the action state of a build.
 */
export const getBuildActionStateTool: Tool = {
  name: 'komodo_get_build_action_state',
  description: 'Get the current action state of a build. Shows if a build operation is currently running.',
  schema: z.object({
    build: z.string().describe(PARAM_DESCRIPTIONS.BUILD_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_build_action_state');
    const result = await wrapApiCall(
      'getBuildActionState',
      () => validClient.resourceInfo.getActionState('Build', args.build, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Build "${args.build}" action state:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to get the action state of a repo.
 */
export const getRepoActionStateTool: Tool = {
  name: 'komodo_get_repo_action_state',
  description:
    'Get the current action state of a repo. Shows if any operation (clone, pull, build) is currently running.',
  schema: z.object({
    repo: z.string().describe(PARAM_DESCRIPTIONS.REPO_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_repo_action_state');
    const result = await wrapApiCall(
      'getRepoActionState',
      () => validClient.resourceInfo.getActionState('Repo', args.repo, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Repo "${args.repo}" action state:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to get the action state of a procedure.
 */
export const getProcedureActionStateTool: Tool = {
  name: 'komodo_get_procedure_action_state',
  description: 'Get the current action state of a procedure. Shows if the procedure is currently running.',
  schema: z.object({
    procedure: z.string().describe(PARAM_DESCRIPTIONS.PROCEDURE_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_procedure_action_state');
    const result = await wrapApiCall(
      'getProcedureActionState',
      () => validClient.resourceInfo.getActionState('Procedure', args.procedure, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Procedure "${args.procedure}" action state:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to get the action state of an action.
 */
export const getActionActionStateTool: Tool = {
  name: 'komodo_get_action_action_state',
  description: 'Get the current action state of an action. Shows if the action is currently running.',
  schema: z.object({
    action: z.string().describe(PARAM_DESCRIPTIONS.ACTION_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_action_action_state');
    const result = await wrapApiCall(
      'getActionActionState',
      () => validClient.resourceInfo.getActionState('Action', args.action, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Action "${args.action}" action state:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to get the action state of a resource sync.
 */
export const getResourceSyncActionStateTool: Tool = {
  name: 'komodo_get_resource_sync_action_state',
  description: 'Get the current action state of a resource sync. Shows if a sync operation is currently running.',
  schema: z.object({
    sync: z.string().describe(PARAM_DESCRIPTIONS.SYNC_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_resource_sync_action_state');
    const result = await wrapApiCall(
      'getResourceSyncActionState',
      () => validClient.resourceInfo.getActionState('ResourceSync', args.sync, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Resource Sync "${args.sync}" action state:\n\n${JSON.stringify(result, null, 2)}`);
  },
};
