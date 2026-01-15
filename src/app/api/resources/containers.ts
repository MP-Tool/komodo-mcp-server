/**
 * Container Resource
 *
 * Provides operations for managing Docker containers on Komodo servers.
 * Supports lifecycle management (start, stop, restart, pause, unpause),
 * inspection, log retrieval, and resource pruning.
 *
 * @module app/api/resources/containers
 */

import { BaseResource } from '../base.js';
import { validateServerId, validateContainerName, validateTail } from '../utils.js';
import type { ApiOperationOptions } from '../base.js';
import type { Types } from 'komodo_client';

// Type aliases for Komodo types
type ContainerListItem = Types.ContainerListItem;
type Container = Types.Container;
type Log = Types.Log;
type Update = Types.Update;

/**
 * Prune target types for resource cleanup.
 */
export type PruneType = 'containers' | 'images' | 'volumes' | 'networks' | 'system' | 'all';

/**
 * Prune action types for execute API.
 */
type PruneAction = 'PruneContainers' | 'PruneImages' | 'PruneVolumes' | 'PruneNetworks' | 'PruneSystem';

/**
 * Container action types for execute API.
 */
type ContainerAction = 'StartContainer' | 'StopContainer' | 'RestartContainer' | 'PauseContainer' | 'UnpauseContainer';

/**
 * Resource for managing Docker containers.
 */
export class ContainerResource extends BaseResource {
  /**
   * Supported container actions for the execute API.
   */
  static CONTAINER_ACTIONS: ContainerAction[] = [
    'StartContainer',
    'StopContainer',
    'RestartContainer',
    'PauseContainer',
    'UnpauseContainer',
  ];

  /**
   * Lists all containers on a specific server.
   *
   * @param serverId - The ID of the server to list containers from
   * @param options - Operation options including abort signal
   * @returns A list of container items
   * @throws ZodError if serverId is invalid
   * @throws Error on API failure or cancellation
   */
  async list(serverId: string, options?: ApiOperationOptions): Promise<ContainerListItem[]> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListDockerContainers', { server: serverId });
    return response || [];
  }

  /**
   * Inspects a specific container to get detailed information.
   *
   * @param serverId - The ID of the server where the container is running
   * @param containerId - The ID or name of the container
   * @param options - Operation options including abort signal
   * @returns Detailed container information
   * @throws ZodError if inputs are invalid
   * @throws Error on API failure or cancellation
   */
  async inspect(serverId: string, containerId: string, options?: ApiOperationOptions): Promise<Container> {
    validateServerId(serverId);
    validateContainerName(containerId);
    this.checkAborted(options?.signal);
    const response = await this.client.read('InspectDockerContainer', {
      server: serverId,
      container: containerId,
    });
    return response;
  }

  /**
   * Starts a container.
   *
   * @param serverId - The ID of the server
   * @param containerName - The name of the container
   * @param options - Operation options including abort signal
   * @returns The update status
   * @throws ZodError if inputs are invalid
   * @throws Error on API failure or cancellation
   */
  async start(serverId: string, containerName: string, options?: ApiOperationOptions): Promise<Update> {
    validateServerId(serverId);
    validateContainerName(containerName);
    return this.executeAction('StartContainer', serverId, containerName, options);
  }

  /**
   * Stops a container.
   *
   * @param serverId - The ID of the server
   * @param containerName - The name of the container
   * @param options - Operation options including abort signal
   * @returns The update status
   * @throws ZodError if inputs are invalid
   * @throws Error on API failure or cancellation
   */
  async stop(serverId: string, containerName: string, options?: ApiOperationOptions): Promise<Update> {
    validateServerId(serverId);
    validateContainerName(containerName);
    return this.executeAction('StopContainer', serverId, containerName, options);
  }

  /**
   * Restarts a container.
   *
   * @param serverId - The ID of the server
   * @param containerName - The name of the container
   * @param options - Operation options including abort signal
   * @returns The update status
   * @throws ZodError if inputs are invalid
   * @throws Error on API failure or cancellation
   */
  async restart(serverId: string, containerName: string, options?: ApiOperationOptions): Promise<Update> {
    validateServerId(serverId);
    validateContainerName(containerName);
    return this.executeAction('RestartContainer', serverId, containerName, options);
  }

  /**
   * Pauses a container.
   *
   * @param serverId - The ID of the server
   * @param containerName - The name of the container
   * @param options - Operation options including abort signal
   * @returns The update status
   * @throws ZodError if inputs are invalid
   * @throws Error on API failure or cancellation
   */
  async pause(serverId: string, containerName: string, options?: ApiOperationOptions): Promise<Update> {
    validateServerId(serverId);
    validateContainerName(containerName);
    return this.executeAction('PauseContainer', serverId, containerName, options);
  }

  /**
   * Unpauses a container.
   *
   * @param serverId - The ID of the server
   * @param containerName - The name of the container
   * @param options - Operation options including abort signal
   * @returns The update status
   * @throws ZodError if inputs are invalid
   * @throws Error on API failure or cancellation
   */
  async unpause(serverId: string, containerName: string, options?: ApiOperationOptions): Promise<Update> {
    validateServerId(serverId);
    validateContainerName(containerName);
    return this.executeAction('UnpauseContainer', serverId, containerName, options);
  }

  /**
   * Prunes unused resources on a server.
   *
   * @param serverId - The ID of the server
   * @param type - The type of resource to prune (containers, images, volumes, networks, system)
   * @param options - Operation options including abort signal
   * @returns The update status
   * @throws ZodError if serverId is invalid
   * @throws Error on API failure or cancellation
   */
  async prune(serverId: string, type: PruneType, options?: ApiOperationOptions): Promise<Update> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);

    // Map prune type to Komodo execute action
    const actionMap: Record<PruneType, PruneAction> = {
      containers: 'PruneContainers',
      images: 'PruneImages',
      volumes: 'PruneVolumes',
      networks: 'PruneNetworks',
      system: 'PruneSystem',
      all: 'PruneSystem',
    };

    const action = actionMap[type];
    const response = await this.client.execute(action, {
      server: serverId,
    });
    return response as Update;
  }

  /**
   * Get logs for a container.
   *
   * @param serverId - The ID of the server
   * @param containerName - The name of the container
   * @param tail - Number of lines to show
   * @param timestamps - Show timestamps
   * @param options - Operation options including abort signal
   * @returns The log object
   * @throws ZodError if inputs are invalid
   * @throws Error on API failure or cancellation
   */
  async logs(
    serverId: string,
    containerName: string,
    tail: number = 100,
    timestamps: boolean = false,
    options?: ApiOperationOptions,
  ): Promise<Log> {
    validateServerId(serverId);
    validateContainerName(containerName);
    validateTail(tail);
    this.checkAborted(options?.signal);

    const response = (await this.client.read('GetContainerLog', {
      server: serverId,
      container: containerName,
      tail,
      timestamps,
    })) as Log;
    return response;
  }

  /**
   * Executes a container action.
   *
   * @param action - The action to execute
   * @param serverId - The ID of the server
   * @param containerName - The name of the container
   * @param options - Operation options including abort signal
   * @returns The update status
   * @throws Error on API failure or cancellation
   */
  private async executeAction(
    action: ContainerAction,
    serverId: string,
    containerName: string,
    options?: ApiOperationOptions,
  ): Promise<Update> {
    this.checkAborted(options?.signal);
    const response = await this.client.execute(action, {
      server: serverId,
      container: containerName,
    });
    return response as Update;
  }
}
