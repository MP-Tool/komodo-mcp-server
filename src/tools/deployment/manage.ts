import { z } from 'zod';
import { Tool } from '../base.js';
import { ERROR_MESSAGES, PARAM_DESCRIPTIONS, CONFIG_DESCRIPTIONS } from '../../config/index.js';
import {
  PartialDeploymentConfigSchema,
  CreateDeploymentConfigSchema,
  DeploymentImageSchema,
} from '../schemas/index.js';

/**
 * Tool to get detailed information about a deployment.
 */
export const getDeploymentInfoTool: Tool = {
  name: 'komodo_get_deployment_info',
  description:
    'Get detailed information about a Komodo deployment including configuration, current state, container status, image, ports, volumes, and environment variables.',
  schema: z.object({
    deployment: z.string().describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID_FOR_INFO),
  }),
  handler: async (args, { client, abortSignal }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.deployments.get(args.deployment, { signal: abortSignal });
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
};

/**
 * Tool to create a new deployment.
 *
 * Provides detailed schema information for AI agents to construct correct payloads.
 * Supports both simple image strings and full Komodo configuration objects.
 */
export const createDeploymentTool: Tool = {
  name: 'komodo_create_deployment',
  description: `Create a new Komodo deployment (Docker container).

REQUIRED: name
RECOMMENDED: server_id (target server) and image (what to deploy)

IMAGE FORMATS:
- Simple string: "nginx:latest", "ghcr.io/owner/repo:v1.0"
- Object format: { type: "Image", params: { image: "nginx:latest" } }
- Komodo Build: { type: "Build", params: { build_id: "..." } }

COMMON CONFIG OPTIONS:
- network: Docker network (default: "host")
- ports: Port mappings like "8080:80\\n443:443"
- volumes: Volume mappings like "/host:/container"
- environment: Env vars like "KEY=value\\nKEY2=value2"
- restart: "no" | "on-failure" | "always" | "unless-stopped"
- labels: Docker labels like "traefik.enable=true"`,
  schema: z.object({
    name: z.string().describe(PARAM_DESCRIPTIONS.DEPLOYMENT_NAME),
    server_id: z.string().optional().describe(PARAM_DESCRIPTIONS.SERVER_ID_FOR_DEPLOY),
    image: z
      .union([z.string().describe('Docker image (e.g., "nginx:latest")'), DeploymentImageSchema])
      .optional()
      .describe('Docker image to deploy'),
    config: CreateDeploymentConfigSchema.optional().describe(CONFIG_DESCRIPTIONS.DEPLOYMENT_CONFIG_CREATE),
  }),
  handler: async (args, { client, abortSignal }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);

    // Build the config object
    const deploymentConfig: Record<string, unknown> = {
      ...args.config,
    };

    if (args.server_id) {
      deploymentConfig.server_id = args.server_id;
    }

    // Handle image - can be string or object
    if (args.image) {
      if (typeof args.image === 'string') {
        // Simple string format: "nginx:latest"
        deploymentConfig.image = { type: 'Image', params: { image: args.image } };
      } else if (typeof args.image === 'object') {
        // Object format: { type: 'Image', params: { image: 'nginx:latest' } }
        deploymentConfig.image = args.image;
      }
    }

    const result = await client.deployments.create(args.name, deploymentConfig, { signal: abortSignal });
    return {
      content: [
        {
          type: 'text',
          text: `Deployment "${args.name}" created successfully.\n\nDeployment Name: ${result.name}\n\nFull Result:\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  },
};

/**
 * Tool to update a deployment.
 *
 * Uses PATCH-style updates - only specify fields you want to change.
 * Provides detailed schema information for AI agents.
 */
export const updateDeploymentTool: Tool = {
  name: 'komodo_update_deployment',
  description: `Update an existing Komodo deployment configuration.

PATCH-STYLE UPDATE: Only specify fields you want to change.

COMMON UPDATE SCENARIOS:
- Change image: { image: { type: "Image", params: { image: "nginx:1.25" } } }
- Update env vars: { environment: "NODE_ENV=production\\nPORT=3000" }
- Change ports: { ports: "8080:80\\n443:443" }
- Update volumes: { volumes: "/data:/app/data" }
- Change restart policy: { restart: "always" }
- Move to different server: { server_id: "new-server-id" }
- Enable auto-update: { auto_update: true }`,
  schema: z.object({
    deployment: z.string().describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID_FOR_UPDATE),
    config: PartialDeploymentConfigSchema.describe(CONFIG_DESCRIPTIONS.DEPLOYMENT_CONFIG_PARTIAL),
  }),
  handler: async (args, { client, abortSignal }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.deployments.update(args.deployment, args.config, { signal: abortSignal });
    return {
      content: [
        {
          type: 'text',
          text: `Deployment "${args.deployment}" updated successfully.\n\nResult: ${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  },
};

/**
 * Tool to delete a deployment.
 */
export const deleteDeploymentTool: Tool = {
  name: 'komodo_delete_deployment',
  description: 'Delete a deployment',
  schema: z.object({
    deployment: z.string().describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.deployments.delete(args.deployment, { signal: abortSignal });
    return {
      content: [
        {
          type: 'text',
          text: `Deployment "${args.deployment}" deleted successfully.\n\nDeleted Deployment:\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  },
};
