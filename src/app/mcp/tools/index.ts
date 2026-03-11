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

import {
  listProceduresTool,
  getProcedureTool,
  createProcedureTool,
  updateProcedureTool,
  deleteProcedureTool,
  runProcedureTool,
} from './procedure/index.js';

import {
  listBuildsTool,
  getBuildTool,
  createBuildTool,
  updateBuildTool,
  deleteBuildTool,
  runBuildTool,
  cancelBuildTool,
} from './image-build/index.js';

import {
  listReposTool,
  getRepoTool,
  createRepoTool,
  updateRepoTool,
  deleteRepoTool,
  cloneRepoTool,
  pullRepoTool,
  buildRepoTool,
} from './repo/index.js';

import {
  listAlertersTool,
  getAlerterTool,
  createAlerterTool,
  updateAlerterTool,
  deleteAlerterTool,
  testAlerterTool,
} from './alerter/index.js';

import {
  listSyncsTool,
  getSyncTool,
  createSyncTool,
  updateSyncTool,
  deleteSyncTool,
  runSyncTool,
  commitSyncTool,
} from './sync/index.js';

import {
  listActionsTool,
  getActionTool,
  createActionTool,
  updateActionTool,
  deleteActionTool,
  runActionTool,
} from './action/index.js';

import {
  listBuildersTool,
  getBuilderTool,
  createBuilderTool,
  updateBuilderTool,
  deleteBuilderTool,
} from './builder/index.js';

import {
  listVariablesTool,
  listTagsTool,
  getVariableTool,
  createVariableTool,
  updateVariableValueTool,
  updateVariableDescriptionTool,
  deleteVariableTool,
  getTagTool,
  createTagTool,
  deleteTagTool,
  renameTagTool,
} from './variable/index.js';

import { listUpdatesTool, listAlertsTool, getUpdateTool, getAlertTool } from './update/index.js';

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

  // Procedure Tools
  toolRegistry.register(listProceduresTool);
  toolRegistry.register(getProcedureTool);
  toolRegistry.register(createProcedureTool);
  toolRegistry.register(updateProcedureTool);
  toolRegistry.register(deleteProcedureTool);
  toolRegistry.register(runProcedureTool);

  // Build Tools
  toolRegistry.register(listBuildsTool);
  toolRegistry.register(getBuildTool);
  toolRegistry.register(createBuildTool);
  toolRegistry.register(updateBuildTool);
  toolRegistry.register(deleteBuildTool);
  toolRegistry.register(runBuildTool);
  toolRegistry.register(cancelBuildTool);

  // Repo Tools
  toolRegistry.register(listReposTool);
  toolRegistry.register(getRepoTool);
  toolRegistry.register(createRepoTool);
  toolRegistry.register(updateRepoTool);
  toolRegistry.register(deleteRepoTool);
  toolRegistry.register(cloneRepoTool);
  toolRegistry.register(pullRepoTool);
  toolRegistry.register(buildRepoTool);

  // Alerter Tools
  toolRegistry.register(listAlertersTool);
  toolRegistry.register(getAlerterTool);
  toolRegistry.register(createAlerterTool);
  toolRegistry.register(updateAlerterTool);
  toolRegistry.register(deleteAlerterTool);
  toolRegistry.register(testAlerterTool);

  // Resource Sync Tools
  toolRegistry.register(listSyncsTool);
  toolRegistry.register(getSyncTool);
  toolRegistry.register(createSyncTool);
  toolRegistry.register(updateSyncTool);
  toolRegistry.register(deleteSyncTool);
  toolRegistry.register(runSyncTool);
  toolRegistry.register(commitSyncTool);

  // Action Tools
  toolRegistry.register(listActionsTool);
  toolRegistry.register(getActionTool);
  toolRegistry.register(createActionTool);
  toolRegistry.register(updateActionTool);
  toolRegistry.register(deleteActionTool);
  toolRegistry.register(runActionTool);

  // Builder Tools
  toolRegistry.register(listBuildersTool);
  toolRegistry.register(getBuilderTool);
  toolRegistry.register(createBuilderTool);
  toolRegistry.register(updateBuilderTool);
  toolRegistry.register(deleteBuilderTool);

  // Variable Tools
  toolRegistry.register(listVariablesTool);
  toolRegistry.register(getVariableTool);
  toolRegistry.register(createVariableTool);
  toolRegistry.register(updateVariableValueTool);
  toolRegistry.register(updateVariableDescriptionTool);
  toolRegistry.register(deleteVariableTool);

  // Tag Tools
  toolRegistry.register(listTagsTool);
  toolRegistry.register(getTagTool);
  toolRegistry.register(createTagTool);
  toolRegistry.register(deleteTagTool);
  toolRegistry.register(renameTagTool);

  // Update & Alert Tools
  toolRegistry.register(listUpdatesTool);
  toolRegistry.register(getUpdateTool);
  toolRegistry.register(listAlertsTool);
  toolRegistry.register(getAlertTool);

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
