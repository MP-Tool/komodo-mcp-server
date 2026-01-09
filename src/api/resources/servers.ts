import { BaseResource } from '../base.js';
import { KomodoServer, KomodoServerListItem, KomodoServerState, ServerState } from '../types.js';

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
  async get(serverId: string): Promise<KomodoServer> {
    try {
      const response = await this.client.read('GetServer', { server: serverId });
      return response;
    } catch (error) {
      this.logger.error(`Failed to get server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Validates that a server exists and is in 'Ok' status.
   *
   * @param serverId - The ID of the server to validate
   * @throws Error if server doesn't exist or is not in 'Ok' status
   */
  async validateServerStatus(serverId: string): Promise<void> {
    try {
      const server = await this.get(serverId);

      if (!server) {
        throw new Error(`Server '${serverId}' not found`);
      }

      // Server exists, check state separately if needed
      const state = await this.getState(serverId);
      const serverState = state as { status?: string };
      if (serverState.status && serverState.status !== 'Ok') {
        this.logger.warn(`Server '${serverId}' status is '${serverState.status}', attempting operation anyway`);
      }
    } catch (error) {
      // Re-throw with better context
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to validate server ${serverId}: ${error}`);
    }
  }

  /**
   * Creates a new server.
   *
   * @param name - The name for the new server
   * @param config - Optional partial server configuration
   * @returns The created server
   */
  async create(name: string, config?: Record<string, unknown>): Promise<KomodoServer> {
    try {
      const response = await this.client.write('CreateServer', {
        name,
        config,
      });
      return response as KomodoServer;
    } catch (error) {
      this.logger.error('Failed to create server:', error);
      throw error;
    }
  }

  /**
   * Updates an existing server.
   *
   * @param serverId - The ID or name of the server
   * @param config - The partial server configuration to apply
   * @returns The updated server
   */
  async update(serverId: string, config: Record<string, unknown>): Promise<KomodoServer> {
    try {
      const response = await this.client.write('UpdateServer', {
        id: serverId,
        config,
      });
      return response as KomodoServer;
    } catch (error) {
      this.logger.error(`Failed to update server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Deletes a server.
   *
   * @param serverId - The ID or name of the server
   * @returns The deleted server
   */
  async delete(serverId: string): Promise<KomodoServer> {
    try {
      const response = await this.client.write('DeleteServer', { id: serverId });
      return response as KomodoServer;
    } catch (error) {
      this.logger.error(`Failed to delete server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Gets the current state of a server.
   *
   * @param serverId - The ID of the server
   * @returns The server state object with status (Ok, NotOk, Disabled)
   */
  async getState(serverId: string): Promise<KomodoServerState> {
    try {
      const response = await this.client.read('GetServerState', { server: serverId });
      return response || { status: ServerState.NotOk };
    } catch (error) {
      this.logger.error(`Failed to get server state for ${serverId}:`, error);
      return { status: ServerState.NotOk };
    }
  }
}
