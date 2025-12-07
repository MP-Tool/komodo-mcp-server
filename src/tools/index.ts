import { toolRegistry } from './base.js';
import { listContainersTool } from './container/list.js';
import {
  startContainerTool,
  stopContainerTool,
  restartContainerTool,
  pauseContainerTool,
  unpauseContainerTool,
} from './container/manage.js';
import { inspectContainerTool } from './container/info.js';
import { pruneResourcesTool } from './container/prune.js';
import { listServersTool } from './server/list.js';
import { getServerStatsTool } from './server/stats.js';
import { getServerInfoTool, createServerTool, updateServerTool, deleteServerTool } from './server/manage.js';
import { listDeploymentsTool } from './deployment/list.js';
import { deployContainerTool } from './deployment/actions.js';
import {
  getDeploymentInfoTool,
  createDeploymentTool,
  updateDeploymentTool,
  deleteDeploymentTool,
} from './deployment/manage.js';
import { listStacksTool } from './stack/list.js';
import { stopStackTool, deployStackTool } from './stack/actions.js';
import { getStackInfoTool, createStackTool, updateStackTool, deleteStackTool } from './stack/manage.js';
import { configureTool } from './config/configure.js';
import { healthCheckTool } from './config/health.js';

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
  toolRegistry.register(getDeploymentInfoTool);
  toolRegistry.register(createDeploymentTool);
  toolRegistry.register(updateDeploymentTool);
  toolRegistry.register(deleteDeploymentTool);

  // Stack Tools
  toolRegistry.register(listStacksTool);
  toolRegistry.register(stopStackTool);
  toolRegistry.register(deployStackTool);
  toolRegistry.register(getStackInfoTool);
  toolRegistry.register(createStackTool);
  toolRegistry.register(updateStackTool);
  toolRegistry.register(deleteStackTool);

  // Config Tools
  toolRegistry.register(configureTool);
  toolRegistry.register(healthCheckTool);
}

export { toolRegistry };
