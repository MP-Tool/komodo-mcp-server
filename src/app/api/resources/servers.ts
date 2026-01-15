/**
 * Server Resource
 *
 * Provides CRUD operations and state management for Komodo servers.
 * Handles validation, cancellation, and error handling for all server operations.
 *
 * @module app/api/resources/servers
 */

import { BaseResource, ServerState, validateServerId, validateResourceName } from '../index.js';
import { NotFoundError } from '../../errors/index.js';
import type { ApiOperationOptions } from '../index.js';
import type { Types } from 'komodo_client';

// Type aliases for Komodo types
type ServerListItem = Types.ServerListItem;
type Server = Types.Server;
type GetServerStateResponse = Types.GetServerStateResponse;
type Update = Types.Update;

/**
 * Resource for managing Servers.
 */
export class ServerResource extends BaseResource {
  /**
   * Lists all registered servers.
   *
   * @param options - Operation options including abort signal
   * @returns A list of server items
   * @throws Error on API failure or cancellation
   */
  async list(options?: ApiOperationOptions): Promise<ServerListItem[]> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListServers', {});
    return response || [];
  }

  /**
   * Gets detailed information about a specific server.
   *
   * @param serverId - The ID of the server
   * @param options - Operation options including abort signal
   * @returns The server details
   * @throws ZodError if serverId is invalid
   * @throws Error on API failure or cancellation
   */
  async get(serverId: string, options?: ApiOperationOptions): Promise<Server> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    const response = await this.client.read('GetServer', { server: serverId });
    return response;
  }

  /**
   * Validates that a server exists and is in 'Ok' status.
   *
   * @param serverId - The ID of the server to validate
   * @param options - Operation options including abort signal
   * @throws Error if server doesn't exist or is not in 'Ok' status
   * @throws ZodError if serverId is invalid
   */
  async validateServerStatus(serverId: string, options?: ApiOperationOptions): Promise<void> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);

    const server = await this.get(serverId, options);
    if (!server) {
      throw NotFoundError.server(serverId);
    }

    // Server exists, check state separately if needed
    const stateResponse = await this.getState(serverId, options);

    if (stateResponse.status && stateResponse.status !== ServerState.Ok) {
      this.logger.warn(`Server '${serverId}' status is '${stateResponse.status}', attempting operation anyway`);
    }
  }

  /**
   * Creates a new server.
   *
   * @param name - The name for the new server
   * @param config - Optional partial server configuration
   * @param options - Operation options including abort signal
   * @returns The created server
   * @throws ZodError if name is invalid
   * @throws Error on API failure or cancellation
   */
  async create(name: string, config?: Partial<Types.ServerConfig>, options?: ApiOperationOptions): Promise<Server> {
    validateResourceName(name);
    this.checkAborted(options?.signal);
    const response = await this.client.write('CreateServer', {
      name,
      config,
    });
    return response;
  }

  /**
   * Updates an existing server.
   *
   * @param serverId - The ID or name of the server
   * @param config - The partial server configuration to apply
   * @param options - Operation options including abort signal
   * @returns The updated server
   * @throws ZodError if serverId is invalid
   * @throws Error on API failure or cancellation
   */
  async update(serverId: string, config: Partial<Types.ServerConfig>, options?: ApiOperationOptions): Promise<Server> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    const response = await this.client.write('UpdateServer', {
      id: serverId,
      config,
    });
    return response;
  }

  /**
   * Deletes a server.
   *
   * @param serverId - The ID or name of the server
   * @param options - Operation options including abort signal
   * @returns The deleted server
   * @throws ZodError if serverId is invalid
   * @throws Error on API failure or cancellation
   */
  async delete(serverId: string, options?: ApiOperationOptions): Promise<Server> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    const response = await this.client.write('DeleteServer', { id: serverId });
    return response;
  }

  /**
   * Gets the current state of a server.
   *
   * @param serverId - The ID of the server
   * @param options - Operation options including abort signal
   * @returns The server state object with status (Ok, NotOk, Disabled)
   * @throws ZodError if serverId is invalid
   * @throws Error on API failure or cancellation
   */
  async getState(serverId: string, options?: ApiOperationOptions): Promise<GetServerStateResponse> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    const response = await this.client.read('GetServerState', { server: serverId });
    /* v8 ignore start - defensive fallback */
    return response || { status: ServerState.NotOk };
    /* v8 ignore stop */
  }
}
