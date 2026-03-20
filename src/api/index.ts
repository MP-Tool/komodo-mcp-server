/**
 * App API Module
 *
 * Main entry point for the Komodo API client layer.
 * Provides the KomodoClient and all related types, resources, and utilities.
 *
 * @module app/api
 *
 * @example
 * ```typescript
 * import { KomodoClient, extractUpdateId } from './api/index.js';
 *
 * // Create client
 * const client = await KomodoClient.login(url, username, password);
 *
 * // Use resources
 * const servers = await client.servers.list();
 * const update = await client.containers.start(serverId, containerName);
 * console.log('Update ID:', extractUpdateId(update));
 * ```
 */

// Client
export { KomodoClient } from './client.js';

// Resources
export { ServerResource, ContainerResource, StackResource, DeploymentResource } from './resources/index.js';
export type { PruneType } from './resources/containers.js';

// Types
export * from './types.js';

// Utils
export {
  extractUpdateId,
  serverIdSchema,
  containerNameSchema,
  stackIdSchema,
  deploymentIdSchema,
  tailSchema,
  resourceNameSchema,
  validateServerId,
  validateContainerName,
  validateStackId,
  validateDeploymentId,
  validateTail,
  validateResourceName,
} from './utils.js';

// Base resource (for extending)
export { BaseResource, OPERATION_TIMEOUTS, DEFAULT_RETRY_CONFIG } from './base.js';
export type { ApiOperationOptions, OperationType, RetryConfig } from './base.js';
