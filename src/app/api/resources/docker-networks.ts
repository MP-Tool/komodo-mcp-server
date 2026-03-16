/**
 * Docker Network Resource
 *
 * Provides operations for managing Docker networks on Komodo servers.
 *
 * @module app/api/resources/docker-networks
 */

import { BaseResource } from '../base.js';
import { validateServerId } from '../utils.js';
import type { ApiOperationOptions } from '../base.js';

/**
 * Resource for managing Docker networks on servers.
 */
export class DockerNetworkResource extends BaseResource {
  /**
   * Lists all Docker networks on a specific server.
   *
   * @param serverId - The ID of the server to list networks from
   * @param options - Operation options including abort signal
   * @returns A list of Docker networks
   * @throws ZodError if serverId is invalid
   * @throws Error on API failure or cancellation
   */
  async list(serverId: string, options?: ApiOperationOptions): Promise<unknown[]> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListDockerNetworks' as never, { server: serverId } as never);
    return (response as unknown[]) || [];
  }

  /**
   * Inspects a specific Docker network to get detailed information.
   *
   * @param serverId - The ID of the server where the network exists
   * @param network - The network name or ID to inspect
   * @param options - Operation options including abort signal
   * @returns Detailed network information
   * @throws ZodError if serverId is invalid
   * @throws Error on API failure or cancellation
   */
  async inspect(serverId: string, network: string, options?: ApiOperationOptions): Promise<unknown> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    const response = await this.client.read('InspectDockerNetwork' as never, { server: serverId, network } as never);
    return response;
  }

  /**
   * Creates a new Docker network on a server.
   *
   * @param serverId - The ID of the server to create the network on
   * @param name - The name for the new network
   * @param options - Operation options including abort signal
   * @returns The creation result
   * @throws ZodError if serverId is invalid
   * @throws Error on API failure or cancellation
   */
  async create(serverId: string, name: string, options?: ApiOperationOptions): Promise<unknown> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    const response = await this.client.write('CreateNetwork' as never, { server: serverId, name } as never);
    return response;
  }

  /**
   * Deletes a Docker network from a server.
   *
   * @param serverId - The ID of the server to delete the network from
   * @param name - The name of the network to delete
   * @param options - Operation options including abort signal
   * @returns The deletion result
   * @throws ZodError if serverId is invalid
   * @throws Error on API failure or cancellation
   */
  async delete(serverId: string, name: string, options?: ApiOperationOptions): Promise<unknown> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    const response = await this.client.execute('DeleteNetwork' as never, { server: serverId, name } as never);
    return response;
  }
}
