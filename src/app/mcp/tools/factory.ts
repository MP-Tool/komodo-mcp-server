/**
 * Tool Factory
 *
 * Provides factory functions to reduce boilerplate when creating action tools.
 * Supports stack, deployment, and container action tools with consistent patterns.
 *
 * @module tools/factory
 */

import { z } from 'zod';
import type { Tool } from './base.js';
import type { KomodoClient } from '../../api/index.js';
import type { Update } from '../../api/types.js';
import { extractUpdateId } from '../../api/utils.js';
import { PARAM_DESCRIPTIONS } from '../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from './utils.js';
import { formatActionResponse, type ActionType } from '../../utils/response-formatter.js';

/**
 * Common action types supported by the factory
 */
export type FactoryActionType = 'deploy' | 'pull' | 'start' | 'restart' | 'pause' | 'unpause' | 'stop' | 'destroy';

/**
 * Stack action method names (type-safe)
 */
export type StackMethodName = 'deploy' | 'pull' | 'start' | 'restart' | 'pause' | 'unpause' | 'stop' | 'destroy';

/**
 * Deployment action method names (type-safe)
 */
export type DeploymentMethodName = 'deploy' | 'pull' | 'start' | 'restart' | 'pause' | 'unpause' | 'stop' | 'destroy';

/**
 * Container action method names (type-safe)
 */
export type ContainerMethodName = 'start' | 'restart' | 'pause' | 'unpause' | 'stop';

/**
 * Type-safe dispatcher for stack actions.
 * Eliminates unsafe type casting by using a switch statement.
 */
function executeStackAction(
  client: KomodoClient,
  method: StackMethodName,
  stackId: string,
  signal?: AbortSignal,
): Promise<Update> {
  const options = { signal };
  switch (method) {
    case 'deploy':
      return client.stacks.deploy(stackId, options);
    case 'pull':
      return client.stacks.pull(stackId, options);
    case 'start':
      return client.stacks.start(stackId, options);
    case 'restart':
      return client.stacks.restart(stackId, options);
    case 'pause':
      return client.stacks.pause(stackId, options);
    case 'unpause':
      return client.stacks.unpause(stackId, options);
    case 'stop':
      return client.stacks.stop(stackId, options);
    case 'destroy':
      return client.stacks.destroy(stackId, options);
  }
}

/**
 * Type-safe dispatcher for deployment actions.
 * Eliminates unsafe type casting by using a switch statement.
 */
function executeDeploymentAction(
  client: KomodoClient,
  method: DeploymentMethodName,
  deploymentId: string,
  signal?: AbortSignal,
): Promise<Update> {
  const options = { signal };
  switch (method) {
    case 'deploy':
      return client.deployments.deploy(deploymentId, options);
    case 'pull':
      return client.deployments.pull(deploymentId, options);
    case 'start':
      return client.deployments.start(deploymentId, options);
    case 'restart':
      return client.deployments.restart(deploymentId, options);
    case 'pause':
      return client.deployments.pause(deploymentId, options);
    case 'unpause':
      return client.deployments.unpause(deploymentId, options);
    case 'stop':
      return client.deployments.stop(deploymentId, options);
    case 'destroy':
      return client.deployments.destroy(deploymentId, options);
  }
}

/**
 * Type-safe dispatcher for container actions.
 * Eliminates unsafe type casting by using a switch statement.
 */
function executeContainerAction(
  client: KomodoClient,
  method: ContainerMethodName,
  serverId: string,
  containerId: string,
  signal?: AbortSignal,
): Promise<Update> {
  const options = { signal };
  switch (method) {
    case 'start':
      return client.containers.start(serverId, containerId, options);
    case 'restart':
      return client.containers.restart(serverId, containerId, options);
    case 'pause':
      return client.containers.pause(serverId, containerId, options);
    case 'unpause':
      return client.containers.unpause(serverId, containerId, options);
    case 'stop':
      return client.containers.stop(serverId, containerId, options);
  }
}

/**
 * Configuration for creating a stack action tool
 */
export interface StackActionConfig {
  /** The action type */
  action: FactoryActionType;
  /** Tool name (e.g., 'komodo_start_stack') */
  name: string;
  /** Tool description */
  description: string;
  /** Method name to call on the stacks resource */
  method: StackMethodName;
}

/**
 * Configuration for creating a deployment action tool
 */
export interface DeploymentActionConfig {
  /** The action type */
  action: FactoryActionType;
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Method name to call on the deployments resource */
  method: DeploymentMethodName;
}

/**
 * Configuration for creating a container action tool
 */
export interface ContainerActionConfig {
  /** The action type */
  action: FactoryActionType;
  /** Tool name */
  name: string;
  /** Tool description */
  description: string;
  /** Method name to call on the containers resource */
  method: ContainerMethodName;
}

/**
 * Creates a stack action tool with consistent pattern.
 *
 * @param config - The tool configuration
 * @returns A Tool definition
 *
 * @example
 * ```typescript
 * export const startStackTool = createStackActionTool({
 *   action: 'start',
 *   name: 'komodo_start_stack',
 *   description: 'Start a stopped Komodo-managed Compose stack.',
 *   method: 'start',
 * });
 * ```
 */
export function createStackActionTool(config: StackActionConfig): Tool {
  const { action, name, description, method } = config;

  return {
    name,
    description,
    schema: z.object({
      stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID),
    }),
    handler: async (args, { client, abortSignal }) => {
      const komodoClient = requireClient(client, name);

      const result = await wrapApiCall(
        `${action} stack '${args.stack}'`,
        () => executeStackAction(komodoClient, method, args.stack, abortSignal),
        abortSignal,
      );

      return successResponse(
        formatActionResponse({
          action: action as ActionType,
          resourceType: 'stack',
          resourceId: args.stack,
          updateId: extractUpdateId(result),
          status: result.status,
        }),
      );
    },
  };
}

/**
 * Creates a deployment action tool with consistent pattern.
 *
 * @param config - The tool configuration
 * @returns A Tool definition
 *
 * @example
 * ```typescript
 * export const startDeploymentTool = createDeploymentActionTool({
 *   action: 'start',
 *   name: 'komodo_start_deployment',
 *   description: 'Start a stopped Komodo-managed deployment.',
 *   method: 'start',
 * });
 * ```
 */
export function createDeploymentActionTool(config: DeploymentActionConfig): Tool {
  const { action, name, description, method } = config;

  return {
    name,
    description,
    schema: z.object({
      deployment: z.string().describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID),
    }),
    handler: async (args, { client, abortSignal }) => {
      const komodoClient = requireClient(client, name);

      const result = await wrapApiCall(
        `${action} deployment '${args.deployment}'`,
        () => executeDeploymentAction(komodoClient, method, args.deployment, abortSignal),
        abortSignal,
      );

      return successResponse(
        formatActionResponse({
          action: action as ActionType,
          resourceType: 'deployment',
          resourceId: args.deployment,
          updateId: extractUpdateId(result),
          status: result.status,
        }),
      );
    },
  };
}

/**
 * Creates a container action tool with consistent pattern.
 *
 * @param config - The tool configuration
 * @returns A Tool definition
 *
 * @example
 * ```typescript
 * export const startContainerTool = createContainerActionTool({
 *   action: 'start',
 *   name: 'komodo_start_container',
 *   description: 'Start a stopped container.',
 *   method: 'start',
 * });
 * ```
 */
export function createContainerActionTool(config: ContainerActionConfig): Tool {
  const { action, name, description, method } = config;

  // Import the container action schema
  const containerActionSchema = z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
    container: z.string().describe(PARAM_DESCRIPTIONS.CONTAINER_ID),
  });

  return {
    name,
    description,
    schema: containerActionSchema,
    handler: async (args, { client, abortSignal }) => {
      const komodoClient = requireClient(client, name);

      const result = await wrapApiCall(
        `${action} container '${args.container}'`,
        () => executeContainerAction(komodoClient, method, args.server, args.container, abortSignal),
        abortSignal,
      );

      return successResponse(
        formatActionResponse({
          action: action as ActionType,
          resourceType: 'container',
          resourceId: args.container,
          serverName: args.server,
          updateId: extractUpdateId(result),
          status: result.status,
        }),
      );
    },
  };
}

/**
 * Batch create multiple stack action tools.
 *
 * @param configs - Array of tool configurations
 * @returns Array of Tool definitions
 */
export function createStackActionTools(configs: StackActionConfig[]): Tool[] {
  return configs.map(createStackActionTool);
}

/**
 * Batch create multiple deployment action tools.
 *
 * @param configs - Array of tool configurations
 * @returns Array of Tool definitions
 */
export function createDeploymentActionTools(configs: DeploymentActionConfig[]): Tool[] {
  return configs.map(createDeploymentActionTool);
}

/**
 * Batch create multiple container action tools.
 *
 * @param configs - Array of tool configurations
 * @returns Array of Tool definitions
 */
export function createContainerActionTools(configs: ContainerActionConfig[]): Tool[] {
  return configs.map(createContainerActionTool);
}
