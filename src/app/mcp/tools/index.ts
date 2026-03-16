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
  startAllContainersTool,
  restartAllContainersTool,
  pauseAllContainersTool,
  unpauseAllContainersTool,
  stopAllContainersTool,
  destroyContainerTool,
  pruneDockerBuildersTool,
  pruneBuildxTool,
} from './container/index.js';

import {
  batchDeployTool,
  batchDestroyDeploymentTool,
  batchDeployStackTool,
  batchDestroyStackTool,
  batchPullStackTool,
  batchRunBuildTool,
  batchCloneRepoTool,
  batchPullRepoTool,
  batchBuildRepoTool,
  batchRunActionTool,
  batchRunProcedureTool,
} from './batch/index.js';

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
  getDeploymentLogTool,
  searchDeploymentLogTool,
  getDeploymentStatsTool,
  getDeploymentContainerTool,
  inspectDeploymentContainerTool,
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
  listStackServicesTool,
  getStackLogTool,
  searchStackLogTool,
  getStackWebhooksEnabledTool,
  deployStackIfChangedTool,
  runStackServiceTool,
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

import {
  listDockerNetworksTool,
  inspectDockerNetworkTool,
  createDockerNetworkTool,
  deleteDockerNetworkTool,
} from './docker-network/index.js';

import {
  listDockerImagesTool,
  inspectDockerImageTool,
  dockerImageHistoryTool,
  deleteDockerImageTool,
} from './docker-image/index.js';

import { listDockerVolumesTool, inspectDockerVolumeTool, deleteDockerVolumeTool } from './docker-volume/index.js';

import {
  getSystemInfoTool,
  getSystemStatsTool,
  listSystemProcessesTool,
  getHistoricalStatsTool,
  getPeripheryVersionTool,
  getCoreInfoTool,
  listComposeProjectsTool,
  getServersSummaryTool,
} from './system/index.js';

import { execContainerTool, execDeploymentTool, execStackTool } from './exec/index.js';

import { listTerminalsTool, createTerminalTool, deleteTerminalTool, deleteAllTerminalsTool } from './terminal/index.js';

import {
  copyServerTool,
  copyDeploymentTool,
  copyStackTool,
  copyBuildTool,
  copyBuilderTool,
  copyRepoTool,
  copyResourceSyncTool,
  copyActionTool,
  copyProcedureTool,
  copyAlerterTool,
  renameServerTool,
  renameDeploymentTool,
  renameStackTool,
  renameBuildTool,
  renameBuilderTool,
  renameRepoTool,
  renameResourceSyncTool,
  renameActionTool,
  renameProcedureTool,
  renameAlerterTool,
} from './resource-ops/index.js';

import {
  createBuildWebhookTool,
  deleteBuildWebhookTool,
  getBuildWebhookEnabledTool,
  createStackWebhookTool,
  deleteStackWebhookTool,
  createRepoWebhookTool,
  deleteRepoWebhookTool,
  getRepoWebhooksEnabledTool,
  createSyncWebhookTool,
  deleteSyncWebhookTool,
  getSyncWebhooksEnabledTool,
  createActionWebhookTool,
  deleteActionWebhookTool,
} from './webhook/index.js';

import {
  listUsersTool,
  findUserTool,
  getUsernameTool,
  createServiceUserTool,
  deleteUserTool,
  updateUsernameTool,
  updateUserPasswordTool,
  updateServiceUserDescriptionTool,
  updateUserAdminTool,
  listUserGroupsTool,
  getUserGroupTool,
  createUserGroupTool,
  renameUserGroupTool,
  deleteUserGroupTool,
  addUserToUserGroupTool,
  removeUserFromUserGroupTool,
} from './user/index.js';

import {
  listPermissionsTool,
  getPermissionTool,
  listUserTargetPermissionsTool,
  updatePermissionOnTargetTool,
  updateUserBasePermissionsTool,
  listApiKeysTool,
  listApiKeysForServiceUserTool,
  createApiKeyForServiceUserTool,
  deleteApiKeyForServiceUserTool,
} from './permission/index.js';

import {
  getServerActionStateTool,
  getDeploymentActionStateTool,
  getStackActionStateTool,
  getBuildActionStateTool,
  getRepoActionStateTool,
  getProcedureActionStateTool,
  getActionActionStateTool,
  getResourceSyncActionStateTool,
  getDeploymentsSummaryTool,
  getStacksSummaryTool,
  getBuildsSummaryTool,
  getBuildersSummaryTool,
  getReposSummaryTool,
  getResourceSyncsSummaryTool,
  getActionsSummaryTool,
  getProceduresSummaryTool,
  getAlertersSummaryTool,
  listFullServersTool,
  listFullDeploymentsTool,
  listFullStacksTool,
  listFullBuildsTool,
  listFullBuildersTool,
  listFullReposTool,
  listFullResourceSyncsTool,
  listFullActionsTool,
  listFullProceduresTool,
  listFullAlertersTool,
} from './resource-info/index.js';

import {
  writeStackFileTool,
  writeBuildFileTool,
  writeSyncFileTool,
  refreshStackCacheTool,
  refreshBuildCacheTool,
  refreshRepoCacheTool,
  refreshResourceSyncPendingTool,
} from './file-ops/index.js';

import {
  listGitProviderAccountsTool,
  getGitProviderAccountTool,
  createGitProviderAccountTool,
  updateGitProviderAccountTool,
  deleteGitProviderAccountTool,
  listDockerRegistryAccountsTool,
  getDockerRegistryAccountTool,
  createDockerRegistryAccountTool,
  updateDockerRegistryAccountTool,
  deleteDockerRegistryAccountTool,
} from './provider/index.js';

import {
  listGitProvidersFromConfigTool,
  listDockerRegistriesFromConfigTool,
  listSecretsTool,
  listSchedulesTool,
  listAllDockerContainersTool,
  getDockerContainersSummaryTool,
  getResourceMatchingContainerTool,
  inspectStackContainerTool,
  getBuildMonthlyStatsTool,
  listBuildVersionsTool,
  listCommonDeploymentExtraArgsTool,
  listCommonStackExtraArgsTool,
  listCommonStackBuildExtraArgsTool,
  listCommonBuildExtraArgsTool,
  updateResourceMetaTool,
  updateTagColorTool,
  updateVariableIsSecretTool,
  createDeploymentFromContainerTool,
  cancelRepoBuildTool,
  sendAlertTool,
  clearRepoCacheTool,
  backupCoreDatabaseTool,
  batchDeployStackIfChangedTool,
  exportAllResourcesToTomlTool,
  exportResourcesToTomlTool,
} from './misc/index.js';

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

  // Deployment Advanced Tools
  toolRegistry.register(getDeploymentLogTool);
  toolRegistry.register(searchDeploymentLogTool);
  toolRegistry.register(getDeploymentStatsTool);
  toolRegistry.register(getDeploymentContainerTool);
  toolRegistry.register(inspectDeploymentContainerTool);

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

  // Stack Advanced Tools
  toolRegistry.register(listStackServicesTool);
  toolRegistry.register(getStackLogTool);
  toolRegistry.register(searchStackLogTool);
  toolRegistry.register(getStackWebhooksEnabledTool);
  toolRegistry.register(deployStackIfChangedTool);
  toolRegistry.register(runStackServiceTool);

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

  // Docker Network Tools
  toolRegistry.register(listDockerNetworksTool);
  toolRegistry.register(inspectDockerNetworkTool);
  toolRegistry.register(createDockerNetworkTool);
  toolRegistry.register(deleteDockerNetworkTool);

  // Docker Image Tools
  toolRegistry.register(listDockerImagesTool);
  toolRegistry.register(inspectDockerImageTool);
  toolRegistry.register(dockerImageHistoryTool);
  toolRegistry.register(deleteDockerImageTool);

  // Docker Volume Tools
  toolRegistry.register(listDockerVolumesTool);
  toolRegistry.register(inspectDockerVolumeTool);
  toolRegistry.register(deleteDockerVolumeTool);

  // System Tools
  toolRegistry.register(getSystemInfoTool);
  toolRegistry.register(getSystemStatsTool);
  toolRegistry.register(listSystemProcessesTool);
  toolRegistry.register(getHistoricalStatsTool);
  toolRegistry.register(getPeripheryVersionTool);
  toolRegistry.register(getCoreInfoTool);
  toolRegistry.register(listComposeProjectsTool);
  toolRegistry.register(getServersSummaryTool);

  // Exec Tools
  toolRegistry.register(execContainerTool);
  toolRegistry.register(execDeploymentTool);
  toolRegistry.register(execStackTool);

  // Bulk Container Tools
  toolRegistry.register(startAllContainersTool);
  toolRegistry.register(restartAllContainersTool);
  toolRegistry.register(pauseAllContainersTool);
  toolRegistry.register(unpauseAllContainersTool);
  toolRegistry.register(stopAllContainersTool);
  toolRegistry.register(destroyContainerTool);
  toolRegistry.register(pruneDockerBuildersTool);
  toolRegistry.register(pruneBuildxTool);

  // Batch Tools
  toolRegistry.register(batchDeployTool);
  toolRegistry.register(batchDestroyDeploymentTool);
  toolRegistry.register(batchDeployStackTool);
  toolRegistry.register(batchDestroyStackTool);
  toolRegistry.register(batchPullStackTool);
  toolRegistry.register(batchRunBuildTool);
  toolRegistry.register(batchCloneRepoTool);
  toolRegistry.register(batchPullRepoTool);
  toolRegistry.register(batchBuildRepoTool);
  toolRegistry.register(batchRunActionTool);
  toolRegistry.register(batchRunProcedureTool);

  // Terminal Tools
  toolRegistry.register(listTerminalsTool);
  toolRegistry.register(createTerminalTool);
  toolRegistry.register(deleteTerminalTool);
  toolRegistry.register(deleteAllTerminalsTool);

  // Resource Copy Tools
  toolRegistry.register(copyServerTool);
  toolRegistry.register(copyDeploymentTool);
  toolRegistry.register(copyStackTool);
  toolRegistry.register(copyBuildTool);
  toolRegistry.register(copyBuilderTool);
  toolRegistry.register(copyRepoTool);
  toolRegistry.register(copyResourceSyncTool);
  toolRegistry.register(copyActionTool);
  toolRegistry.register(copyProcedureTool);
  toolRegistry.register(copyAlerterTool);

  // Resource Rename Tools
  toolRegistry.register(renameServerTool);
  toolRegistry.register(renameDeploymentTool);
  toolRegistry.register(renameStackTool);
  toolRegistry.register(renameBuildTool);
  toolRegistry.register(renameBuilderTool);
  toolRegistry.register(renameRepoTool);
  toolRegistry.register(renameResourceSyncTool);
  toolRegistry.register(renameActionTool);
  toolRegistry.register(renameProcedureTool);
  toolRegistry.register(renameAlerterTool);

  // Webhook Tools
  toolRegistry.register(createBuildWebhookTool);
  toolRegistry.register(deleteBuildWebhookTool);
  toolRegistry.register(getBuildWebhookEnabledTool);
  toolRegistry.register(createStackWebhookTool);
  toolRegistry.register(deleteStackWebhookTool);
  toolRegistry.register(createRepoWebhookTool);
  toolRegistry.register(deleteRepoWebhookTool);
  toolRegistry.register(getRepoWebhooksEnabledTool);
  toolRegistry.register(createSyncWebhookTool);
  toolRegistry.register(deleteSyncWebhookTool);
  toolRegistry.register(getSyncWebhooksEnabledTool);
  toolRegistry.register(createActionWebhookTool);
  toolRegistry.register(deleteActionWebhookTool);

  // User Tools
  toolRegistry.register(listUsersTool);
  toolRegistry.register(findUserTool);
  toolRegistry.register(getUsernameTool);
  toolRegistry.register(createServiceUserTool);
  toolRegistry.register(deleteUserTool);
  toolRegistry.register(updateUsernameTool);
  toolRegistry.register(updateUserPasswordTool);
  toolRegistry.register(updateServiceUserDescriptionTool);
  toolRegistry.register(updateUserAdminTool);

  // User Group Tools
  toolRegistry.register(listUserGroupsTool);
  toolRegistry.register(getUserGroupTool);
  toolRegistry.register(createUserGroupTool);
  toolRegistry.register(renameUserGroupTool);
  toolRegistry.register(deleteUserGroupTool);
  toolRegistry.register(addUserToUserGroupTool);
  toolRegistry.register(removeUserFromUserGroupTool);

  // Permission Tools
  toolRegistry.register(listPermissionsTool);
  toolRegistry.register(getPermissionTool);
  toolRegistry.register(listUserTargetPermissionsTool);
  toolRegistry.register(updatePermissionOnTargetTool);
  toolRegistry.register(updateUserBasePermissionsTool);

  // API Key Tools
  toolRegistry.register(listApiKeysTool);
  toolRegistry.register(listApiKeysForServiceUserTool);
  toolRegistry.register(createApiKeyForServiceUserTool);
  toolRegistry.register(deleteApiKeyForServiceUserTool);

  // Resource Info: Action State Tools
  toolRegistry.register(getServerActionStateTool);
  toolRegistry.register(getDeploymentActionStateTool);
  toolRegistry.register(getStackActionStateTool);
  toolRegistry.register(getBuildActionStateTool);
  toolRegistry.register(getRepoActionStateTool);
  toolRegistry.register(getProcedureActionStateTool);
  toolRegistry.register(getActionActionStateTool);
  toolRegistry.register(getResourceSyncActionStateTool);

  // Resource Info: Summary Tools
  toolRegistry.register(getDeploymentsSummaryTool);
  toolRegistry.register(getStacksSummaryTool);
  toolRegistry.register(getBuildsSummaryTool);
  toolRegistry.register(getBuildersSummaryTool);
  toolRegistry.register(getReposSummaryTool);
  toolRegistry.register(getResourceSyncsSummaryTool);
  toolRegistry.register(getActionsSummaryTool);
  toolRegistry.register(getProceduresSummaryTool);
  toolRegistry.register(getAlertersSummaryTool);

  // Resource Info: List Full Tools
  toolRegistry.register(listFullServersTool);
  toolRegistry.register(listFullDeploymentsTool);
  toolRegistry.register(listFullStacksTool);
  toolRegistry.register(listFullBuildsTool);
  toolRegistry.register(listFullBuildersTool);
  toolRegistry.register(listFullReposTool);
  toolRegistry.register(listFullResourceSyncsTool);
  toolRegistry.register(listFullActionsTool);
  toolRegistry.register(listFullProceduresTool);
  toolRegistry.register(listFullAlertersTool);

  // File Operations Tools
  toolRegistry.register(writeStackFileTool);
  toolRegistry.register(writeBuildFileTool);
  toolRegistry.register(writeSyncFileTool);
  toolRegistry.register(refreshStackCacheTool);
  toolRegistry.register(refreshBuildCacheTool);
  toolRegistry.register(refreshRepoCacheTool);
  toolRegistry.register(refreshResourceSyncPendingTool);

  // Provider Tools
  toolRegistry.register(listGitProviderAccountsTool);
  toolRegistry.register(getGitProviderAccountTool);
  toolRegistry.register(createGitProviderAccountTool);
  toolRegistry.register(updateGitProviderAccountTool);
  toolRegistry.register(deleteGitProviderAccountTool);
  toolRegistry.register(listDockerRegistryAccountsTool);
  toolRegistry.register(getDockerRegistryAccountTool);
  toolRegistry.register(createDockerRegistryAccountTool);
  toolRegistry.register(updateDockerRegistryAccountTool);
  toolRegistry.register(deleteDockerRegistryAccountTool);

  // Misc Tools
  toolRegistry.register(listGitProvidersFromConfigTool);
  toolRegistry.register(listDockerRegistriesFromConfigTool);
  toolRegistry.register(listSecretsTool);
  toolRegistry.register(listSchedulesTool);
  toolRegistry.register(listAllDockerContainersTool);
  toolRegistry.register(getDockerContainersSummaryTool);
  toolRegistry.register(getResourceMatchingContainerTool);
  toolRegistry.register(inspectStackContainerTool);
  toolRegistry.register(getBuildMonthlyStatsTool);
  toolRegistry.register(listBuildVersionsTool);
  toolRegistry.register(listCommonDeploymentExtraArgsTool);
  toolRegistry.register(listCommonStackExtraArgsTool);
  toolRegistry.register(listCommonStackBuildExtraArgsTool);
  toolRegistry.register(listCommonBuildExtraArgsTool);
  toolRegistry.register(updateResourceMetaTool);
  toolRegistry.register(updateTagColorTool);
  toolRegistry.register(updateVariableIsSecretTool);
  toolRegistry.register(createDeploymentFromContainerTool);
  toolRegistry.register(cancelRepoBuildTool);
  toolRegistry.register(sendAlertTool);
  toolRegistry.register(clearRepoCacheTool);
  toolRegistry.register(backupCoreDatabaseTool);
  toolRegistry.register(batchDeployStackIfChangedTool);
  toolRegistry.register(exportAllResourcesToTomlTool);
  toolRegistry.register(exportResourcesToTomlTool);

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
