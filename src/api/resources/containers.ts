import { BaseResource, ApiOperationOptions } from '../base.js';
import { KomodoContainer, KomodoContainerListItem, KomodoUpdate, KomodoLog } from '../types.js';
import { validateServerId, validateContainerName, validateTail } from '../utils.js';

/**
 * Resource for managing Docker containers.
 */
export class ContainerResource extends BaseResource {
  /**
   * Lists all containers on a specific server.
   *
   * @param serverId - The ID of the server to list containers from
   * @param options - Operation options including abort signal
   * @returns A list of container items
   * @throws ZodError if serverId is invalid
   * @throws Error on API failure or cancellation
   */
  async list(serverId: string, options?: ApiOperationOptions): Promise<KomodoContainerListItem[]> {
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
  async inspect(serverId: string, containerId: string, options?: ApiOperationOptions): Promise<KomodoContainer> {
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
  async start(serverId: string, containerName: string, options?: ApiOperationOptions): Promise<KomodoUpdate> {
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
  async stop(serverId: string, containerName: string, options?: ApiOperationOptions): Promise<KomodoUpdate> {
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
  async restart(serverId: string, containerName: string, options?: ApiOperationOptions): Promise<KomodoUpdate> {
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
  async pause(serverId: string, containerName: string, options?: ApiOperationOptions): Promise<KomodoUpdate> {
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
  async unpause(serverId: string, containerName: string, options?: ApiOperationOptions): Promise<KomodoUpdate> {
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
  async prune(
    serverId: string,
    type: 'containers' | 'images' | 'volumes' | 'networks' | 'system' | 'all',
    options?: ApiOperationOptions,
  ): Promise<KomodoUpdate> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);

    // Map prune type to Komodo execute action
    const actionMap = {
      containers: 'PruneContainers',
      images: 'PruneImages',
      volumes: 'PruneVolumes',
      networks: 'PruneNetworks',
      system: 'PruneSystem',
      all: 'PruneSystem',
    } as const;

    const action = actionMap[type];
    const response = await this.client.execute(action, {
      server: serverId,
    });
    return response as KomodoUpdate;
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
  ): Promise<KomodoLog> {
    validateServerId(serverId);
    validateContainerName(containerName);
    validateTail(tail);
    this.checkAborted(options?.signal);

    const response = (await this.client.read('GetContainerLog', {
      server: serverId,
      container: containerName,
      tail,
      timestamps,
    })) as KomodoLog;
    return response;
  }

  /**
   * Supported container actions for the execute API
   */
  private static readonly CONTAINER_ACTIONS = [
    'StartContainer',
    'StopContainer',
    'RestartContainer',
    'PauseContainer',
    'UnpauseContainer',
  ] as const;

  private async executeAction(
    action: (typeof ContainerResource.CONTAINER_ACTIONS)[number],
    serverId: string,
    containerName: string,
    options?: ApiOperationOptions,
  ): Promise<KomodoUpdate> {
    this.checkAborted(options?.signal);

    const response = await this.client.execute(action, {
      server: serverId,
      container: containerName,
    });
    return response as KomodoUpdate;
  }
}
