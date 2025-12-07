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
