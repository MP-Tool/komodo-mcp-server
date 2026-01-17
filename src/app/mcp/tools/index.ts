/**
 * Tools Module
 *
 * Central registration point for all MCP tools.
 * Uses barrel exports from sub-modules for clean imports.
 *
 * @module tools
 */

import { toolRegistry } from './base.js';

// Import tools from barrel files
import {
  listContainersTool,
  startContainerTool,
  stopContainerTool,
  restartContainerTool,
  pauseContainerTool,
  unpauseContainerTool,
  inspectContainerTool,
  getContainerLogsTool,
  searchContainerLogsTool,
  pruneResourcesTool,
} from './container/index.js';

import {
  listServersTool,
  getServerStatsTool,
  getServerInfoTool,
  createServerTool,
  updateServerTool,
  deleteServerTool,
} from './server/index.js';

import {
  listDeploymentsTool,
  deployContainerTool,
  pullDeploymentImageTool,
  startDeploymentTool,
  restartDeploymentTool,
  pauseDeploymentTool,
  unpauseDeploymentTool,
  stopDeploymentTool,
  destroyDeploymentTool,
  getDeploymentInfoTool,
  createDeploymentTool,
  updateDeploymentTool,
  deleteDeploymentTool,
} from './deployment/index.js';

import {
  listStacksTool,
  deployStackTool,
  pullStackTool,
  startStackTool,
  restartStackTool,
  pauseStackTool,
  unpauseStackTool,
  stopStackTool,
  destroyStackTool,
  getStackInfoTool,
  createStackTool,
  updateStackTool,
  deleteStackTool,
} from './stack/index.js';

import { configureTool, healthCheckTool } from './config/index.js';

/**
 * Registers all available tools with the tool registry.
 * This function should be called during server initialization.
 */
export function registerTools() {
  // Container Tools
  toolRegistry.register(listContainersTool);
  toolRegistry.register(startContainerTool);
  toolRegistry.register(stopContainerTool);
  toolRegistry.register(restartContainerTool);
  toolRegistry.register(pauseContainerTool);
  toolRegistry.register(unpauseContainerTool);
  toolRegistry.register(inspectContainerTool);
  toolRegistry.register(getContainerLogsTool);
  toolRegistry.register(searchContainerLogsTool);
  toolRegistry.register(pruneResourcesTool);

  // Server Tools
  toolRegistry.register(listServersTool);
  toolRegistry.register(getServerStatsTool);
  toolRegistry.register(getServerInfoTool);
  toolRegistry.register(createServerTool);
  toolRegistry.register(updateServerTool);
  toolRegistry.register(deleteServerTool);

  // Deployment Tools
  toolRegistry.register(listDeploymentsTool);
  toolRegistry.register(deployContainerTool);
  toolRegistry.register(pullDeploymentImageTool);
  toolRegistry.register(startDeploymentTool);
  toolRegistry.register(restartDeploymentTool);
  toolRegistry.register(pauseDeploymentTool);
  toolRegistry.register(unpauseDeploymentTool);
  toolRegistry.register(stopDeploymentTool);
  toolRegistry.register(destroyDeploymentTool);
  toolRegistry.register(getDeploymentInfoTool);
  toolRegistry.register(createDeploymentTool);
  toolRegistry.register(updateDeploymentTool);
  toolRegistry.register(deleteDeploymentTool);

  // Stack Tools
  toolRegistry.register(listStacksTool);
  toolRegistry.register(deployStackTool);
  toolRegistry.register(pullStackTool);
  toolRegistry.register(startStackTool);
  toolRegistry.register(restartStackTool);
  toolRegistry.register(pauseStackTool);
  toolRegistry.register(unpauseStackTool);
  toolRegistry.register(stopStackTool);
  toolRegistry.register(destroyStackTool);
  toolRegistry.register(getStackInfoTool);
  toolRegistry.register(createStackTool);
  toolRegistry.register(updateStackTool);
  toolRegistry.register(deleteStackTool);

  // Config Tools
  toolRegistry.register(configureTool);
  toolRegistry.register(healthCheckTool);
}

// Export registry and types
export { toolRegistry, type Tool, type ToolContext } from './base.js';

// Export factory functions
export {
  createStackActionTool,
  createDeploymentActionTool,
  createContainerActionTool,
  createStackActionTools,
  createDeploymentActionTools,
  createContainerActionTools,
  type FactoryActionType,
  type StackActionConfig,
  type DeploymentActionConfig,
  type ContainerActionConfig,
} from './factory.js';
