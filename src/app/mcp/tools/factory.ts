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
 * Resource-specific action method signatures
 */
export interface StackActionMethod {
  (stackId: string, options?: { signal?: AbortSignal }): Promise<Update>;
}

export interface DeploymentActionMethod {
  (deploymentId: string, options?: { signal?: AbortSignal }): Promise<Update>;
}

export interface ContainerActionMethod {
  (serverId: string, containerId: string, options?: { signal?: AbortSignal }): Promise<Update>;
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
  method: 'deploy' | 'pull' | 'start' | 'restart' | 'pause' | 'unpause' | 'stop' | 'destroy';
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
  method: 'deploy' | 'pull' | 'start' | 'restart' | 'pause' | 'unpause' | 'stop' | 'destroy';
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
  method: 'start' | 'restart' | 'pause' | 'unpause' | 'stop';
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
      const stackMethod = komodoClient.stacks[method] as StackActionMethod;

      const result = await wrapApiCall(
        `${action} stack '${args.stack}'`,
        () => stackMethod.call(komodoClient.stacks, args.stack, { signal: abortSignal }),
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
      const deploymentMethod = komodoClient.deployments[method] as DeploymentActionMethod;

      const result = await wrapApiCall(
        `${action} deployment '${args.deployment}'`,
        () => deploymentMethod.call(komodoClient.deployments, args.deployment, { signal: abortSignal }),
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
      const containerMethod = komodoClient.containers[method] as ContainerActionMethod;

      const result = await wrapApiCall(
        `${action} container '${args.container}'`,
        () => containerMethod.call(komodoClient.containers, args.server, args.container, { signal: abortSignal }),
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
