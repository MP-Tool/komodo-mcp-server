import { BaseResource } from '../base.js';
import { KomodoServerListItem } from '../types.js';

/**
 * Resource for managing Servers.
 */
export class ServerResource extends BaseResource {
  /**
   * Lists all registered servers.
   *
   * @returns A list of server items
   */
  async list(): Promise<KomodoServerListItem[]> {
    try {
      const response = await this.client.read('ListServers', {});
      return response || [];
    } catch (error) {
      this.logger.error('Failed to list servers:', error);
      return [];
    }
  }

  /**
   * Gets detailed information about a specific server.
   *
   * @param serverId - The ID of the server
   * @returns The server details
   */
  async get(serverId: string): Promise<any> {
    try {
      const response = await this.client.read('GetServer', { server: serverId });
      return response;
    } catch (error) {
      this.logger.error(`Failed to get server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Creates a new server.
   *
   * @param config - The server configuration
   * @returns The created server
   */
  async create(config: any): Promise<any> {
    try {
      // @ts-ignore - CreateServer is valid but types might be desynced
      const response = await this.client.execute('CreateServer', config);
      return response;
    } catch (error) {
      this.logger.error('Failed to create server:', error);
      throw error;
    }
  }

  /**
   * Updates an existing server.
   *
   * @param serverId - The ID of the server
   * @param config - The new server configuration
   * @returns The updated server
   */
  async update(serverId: string, config: any): Promise<any> {
    try {
      // @ts-ignore - UpdateServer is valid but types might be desynced
      const response = await this.client.execute('UpdateServer', {
        server: serverId,
        ...config,
      });
      return response;
    } catch (error) {
      this.logger.error(`Failed to update server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Deletes a server.
   *
   * @param serverId - The ID of the server
   * @returns The result of the deletion
   */
  async delete(serverId: string): Promise<void> {
    try {
      // @ts-ignore - DeleteServer is valid but types might be desynced
      await this.client.execute('DeleteServer', { server: serverId });
    } catch (error) {
      this.logger.error(`Failed to delete server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Gets the current state of a server.
   *
   * @param serverId - The ID of the server
   * @returns The server state object
   */
  async getState(serverId: string): Promise<unknown> {
    try {
      const response = await this.client.read('GetServerState', { server: serverId });
      return response || { status: 'NotOk' };
    } catch (error) {
      this.logger.error(`Failed to get server state for ${serverId}:`, error);
      return { status: 'NotOk' };
    }
  }
}
