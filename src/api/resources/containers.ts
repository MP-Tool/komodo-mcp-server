import { BaseResource } from '../base.js';
import { KomodoContainer, KomodoContainerListItem, KomodoUpdate, KomodoLog } from '../types.js';

/**
 * Resource for managing Docker containers.
 */
export class ContainerResource extends BaseResource {
  /**
   * Lists all containers on a specific server.
   *
   * @param serverId - The ID of the server to list containers from
   * @returns A list of container items
   */
  async list(serverId: string): Promise<KomodoContainerListItem[]> {
    try {
      const response = await this.client.read('ListDockerContainers', { server: serverId });
      return response || [];
    } catch (error) {
      this.logger.error(`Failed to list containers for server ${serverId}:`, error);
      return [];
    }
  }

  /**
   * Inspects a specific container to get detailed information.
   *
   * @param serverId - The ID of the server where the container is running
   * @param containerId - The ID or name of the container
   * @returns Detailed container information
   */
  async inspect(serverId: string, containerId: string): Promise<KomodoContainer> {
    try {
      const response = await this.client.read('InspectDockerContainer', {
        server: serverId,
        container: containerId,
      });
      return response;
    } catch (error) {
      this.logger.error(`Failed to inspect container ${containerId} on server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Starts a container.
   *
   * @param serverId - The ID of the server
   * @param containerName - The name of the container
   * @returns The update status
   */
  async start(serverId: string, containerName: string): Promise<KomodoUpdate> {
    return this.executeAction('StartContainer', serverId, containerName);
  }

  /**
   * Stops a container.
   *
   * @param serverId - The ID of the server
   * @param containerName - The name of the container
   * @returns The update status
   */
  async stop(serverId: string, containerName: string): Promise<KomodoUpdate> {
    return this.executeAction('StopContainer', serverId, containerName);
  }

  /**
   * Restarts a container.
   *
   * @param serverId - The ID of the server
   * @param containerName - The name of the container
   * @returns The update status
   */
  async restart(serverId: string, containerName: string): Promise<KomodoUpdate> {
    return this.executeAction('RestartContainer', serverId, containerName);
  }

  /**
   * Pauses a container.
   *
   * @param serverId - The ID of the server
   * @param containerName - The name of the container
   * @returns The update status
   */
  async pause(serverId: string, containerName: string): Promise<KomodoUpdate> {
    return this.executeAction('PauseContainer', serverId, containerName);
  }

  /**
   * Unpauses a container.
   *
   * @param serverId - The ID of the server
   * @param containerName - The name of the container
   * @returns The update status
   */
  async unpause(serverId: string, containerName: string): Promise<KomodoUpdate> {
    return this.executeAction('UnpauseContainer', serverId, containerName);
  }

  /**
   * Prunes unused resources on a server.
   *
   * @param serverId - The ID of the server
   * @param type - The type of resource to prune (containers, images, volumes, networks, system)
   * @returns The update status
   */
  async prune(
    serverId: string,
    type: 'containers' | 'images' | 'volumes' | 'networks' | 'system' | 'all',
  ): Promise<KomodoUpdate> {
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

    try {
      const response = await this.client.execute(action, {
        server: serverId,
      });
      return response as KomodoUpdate;
    } catch (error) {
      this.logger.error(`Failed to prune ${type} on server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Get logs for a container.
   *
   * @param serverId - The ID of the server
   * @param containerName - The name of the container
   * @param tail - Number of lines to show
   * @param timestamps - Show timestamps
   * @returns The log object
   */
  async logs(
    serverId: string,
    containerName: string,
    tail: number = 100,
    timestamps: boolean = false,
  ): Promise<KomodoLog> {
    try {
      const response = (await this.client.read('GetContainerLog', {
        server: serverId,
        container: containerName,
        tail,
        timestamps,
      })) as KomodoLog;
      return response;
    } catch (error) {
      this.logger.error(`Failed to get logs for container ${containerName} on server ${serverId}:`, error);
      throw error;
    }
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
  ): Promise<KomodoUpdate> {
    try {
      const response = await this.client.execute(action, {
        server: serverId,
        container: containerName,
      });
      return response as KomodoUpdate;
    } catch (error) {
      this.logger.error(`Failed to ${action} container ${containerName} on server ${serverId}:`, error);
      throw error;
    }
  }
}
