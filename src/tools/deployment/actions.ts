import { z } from 'zod';
import { Tool } from '../base.js';
import { extractUpdateId } from '../../api/utils.js';
import { ERROR_MESSAGES, PARAM_DESCRIPTIONS } from '../../config/index.js';

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
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.deployments.deploy(args.deployment);
    return {
      content: [
        {
          type: 'text',
          text: `🚀 Deployment "${args.deployment}" started.\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`,
        },
      ],
    };
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
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.deployments.pull(args.deployment);
    return {
      content: [
        {
          type: 'text',
          text: `📥 Image pull for deployment "${args.deployment}" initiated.\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`,
        },
      ],
    };
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
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.deployments.start(args.deployment);
    return {
      content: [
        {
          type: 'text',
          text: `▶️ Deployment "${args.deployment}" started.\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`,
        },
      ],
    };
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
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.deployments.restart(args.deployment);
    return {
      content: [
        {
          type: 'text',
          text: `🔄 Deployment "${args.deployment}" restarted.\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`,
        },
      ],
    };
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
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.deployments.pause(args.deployment);
    return {
      content: [
        {
          type: 'text',
          text: `⏸️ Deployment "${args.deployment}" paused.\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`,
        },
      ],
    };
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
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.deployments.unpause(args.deployment);
    return {
      content: [
        {
          type: 'text',
          text: `▶️ Deployment "${args.deployment}" unpaused.\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`,
        },
      ],
    };
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
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.deployments.stop(args.deployment);
    return {
      content: [
        {
          type: 'text',
          text: `⏹️ Deployment "${args.deployment}" stopped.\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`,
        },
      ],
    };
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
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.deployments.destroy(args.deployment);
    return {
      content: [
        {
          type: 'text',
          text: `🗑️ Deployment container "${args.deployment}" destroyed.\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`,
        },
      ],
    };
  },
};
