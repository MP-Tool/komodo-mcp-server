import { z } from 'zod';
import { Tool } from '../base.js';
import { extractUpdateId } from '../../../api/utils.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { formatActionResponse } from '../../../utils/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

/**
 * Tool to deploy a Komodo-managed deployment.
 */
export const deployContainerTool: Tool = {
  name: 'komodo_deploy_container',
  description:
    'Deploy or redeploy a Komodo-managed deployment. This pulls the configured image and (re)creates the container based on the deployment configuration.',
  schema: z.object({
    deployment: z.string().describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_deploy_container');
    const result = await wrapApiCall(
      `deploy '${args.deployment}'`,
      () => komodoClient.deployments.deploy(args.deployment, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'deploy',
        resourceType: 'deployment',
        resourceId: args.deployment,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
};

/**
 * Tool to pull the latest image for a Komodo deployment.
 */
export const pullDeploymentImageTool: Tool = {
  name: 'komodo_pull_deployment_image',
  description:
    'Pull the latest image for a Komodo-managed deployment without recreating the container. Useful to pre-pull images before a scheduled deployment.',
  schema: z.object({
    deployment: z.string().describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_pull_deployment_image');
    const result = await wrapApiCall(
      `pull image for '${args.deployment}'`,
      () => komodoClient.deployments.pull(args.deployment, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'pull',
        resourceType: 'deployment',
        resourceId: args.deployment,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
};

/**
 * Tool to start a Komodo-managed deployment.
 */
export const startDeploymentTool: Tool = {
  name: 'komodo_start_deployment',
  description:
    'Start a stopped Komodo-managed deployment. Use this to resume a deployment that was previously stopped.',
  schema: z.object({
    deployment: z.string().describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_start_deployment');
    const result = await wrapApiCall(
      `start deployment '${args.deployment}'`,
      () => komodoClient.deployments.start(args.deployment, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'start',
        resourceType: 'deployment',
        resourceId: args.deployment,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
};

/**
 * Tool to restart a Komodo-managed deployment.
 */
export const restartDeploymentTool: Tool = {
  name: 'komodo_restart_deployment',
  description: 'Restart a Komodo-managed deployment. Stops and starts the container without pulling a new image.',
  schema: z.object({
    deployment: z.string().describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_restart_deployment');
    const result = await wrapApiCall(
      `restart deployment '${args.deployment}'`,
      () => komodoClient.deployments.restart(args.deployment, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'restart',
        resourceType: 'deployment',
        resourceId: args.deployment,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
};

/**
 * Tool to pause a Komodo-managed deployment.
 */
export const pauseDeploymentTool: Tool = {
  name: 'komodo_pause_deployment',
  description:
    'Pause a running Komodo-managed deployment. Suspends all processes in the container without stopping it.',
  schema: z.object({
    deployment: z.string().describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_pause_deployment');
    const result = await wrapApiCall(
      `pause deployment '${args.deployment}'`,
      () => komodoClient.deployments.pause(args.deployment, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'pause',
        resourceType: 'deployment',
        resourceId: args.deployment,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
};

/**
 * Tool to unpause a Komodo-managed deployment.
 */
export const unpauseDeploymentTool: Tool = {
  name: 'komodo_unpause_deployment',
  description: 'Unpause a paused Komodo-managed deployment. Resumes all suspended processes in the container.',
  schema: z.object({
    deployment: z.string().describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_unpause_deployment');
    const result = await wrapApiCall(
      `unpause deployment '${args.deployment}'`,
      () => komodoClient.deployments.unpause(args.deployment, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'unpause',
        resourceType: 'deployment',
        resourceId: args.deployment,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
};

/**
 * Tool to stop a Komodo-managed deployment.
 */
export const stopDeploymentTool: Tool = {
  name: 'komodo_stop_deployment',
  description:
    'Stop a running Komodo-managed deployment. The container is stopped but can be started again with start_deployment.',
  schema: z.object({
    deployment: z.string().describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_stop_deployment');
    const result = await wrapApiCall(
      `stop deployment '${args.deployment}'`,
      () => komodoClient.deployments.stop(args.deployment, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'stop',
        resourceType: 'deployment',
        resourceId: args.deployment,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
};

/**
 * Tool to destroy (remove) a Komodo-managed deployment container.
 */
export const destroyDeploymentTool: Tool = {
  name: 'komodo_destroy_deployment',
  description:
    'Destroy (remove) the container of a Komodo-managed deployment. The deployment configuration in Komodo is preserved and can be redeployed later.',
  schema: z.object({
    deployment: z.string().describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_destroy_deployment');
    const result = await wrapApiCall(
      `destroy deployment '${args.deployment}'`,
      () => komodoClient.deployments.destroy(args.deployment, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'destroy',
        resourceType: 'deployment',
        resourceId: args.deployment,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
};
