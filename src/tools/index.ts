import { toolRegistry } from './base.js';
import { listContainersTool } from './container/list.js';
import {
  startContainerTool,
  stopContainerTool,
  restartContainerTool,
  pauseContainerTool,
  unpauseContainerTool,
} from './container/manage.js';
import { listServersTool } from './server/list.js';
import { getServerStatsTool } from './server/stats.js';
import { listDeploymentsTool } from './deployment/list.js';
import { deployContainerTool } from './deployment/actions.js';
import { listStacksTool } from './stack/list.js';
import { stopStackTool, deployStackTool } from './stack/actions.js';
import { configureTool } from './config/configure.js';
import { healthCheckTool } from './config/health.js';

/**
 * Registers all available tools with the tool registry.
 * This function should be called during server initialization.
 */
export function registerTools() {
  toolRegistry.register(listContainersTool);
  toolRegistry.register(startContainerTool);
  toolRegistry.register(stopContainerTool);
  toolRegistry.register(restartContainerTool);
  toolRegistry.register(pauseContainerTool);
  toolRegistry.register(unpauseContainerTool);
  toolRegistry.register(listServersTool);
  toolRegistry.register(getServerStatsTool);
  toolRegistry.register(listDeploymentsTool);
  toolRegistry.register(deployContainerTool);
  toolRegistry.register(listStacksTool);
  toolRegistry.register(stopStackTool);
  toolRegistry.register(deployStackTool);
  toolRegistry.register(configureTool);
  toolRegistry.register(healthCheckTool);
}

export { toolRegistry };
