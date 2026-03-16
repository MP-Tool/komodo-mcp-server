/**
 * Docker Volume Resource
 *
 * Provides operations for managing Docker volumes on Komodo servers.
 * Supports listing, inspection, and deletion.
 *
 * @module app/api/resources/docker-volumes
 */

import { BaseResource } from '../base.js';
import { validateServerId } from '../utils.js';
import type { ApiOperationOptions } from '../base.js';

/**
 * Resource for managing Docker volumes on servers.
 */
export class DockerVolumeResource extends BaseResource {
  /**
   * Lists all Docker volumes on a specific server.
   *
   * @param serverId - The ID of the server to list volumes from
   * @param options - Operation options including abort signal
   * @returns A list of volume items
   * @throws ZodError if serverId is invalid
   * @throws Error on API failure or cancellation
   */
  async list(serverId: string, options?: ApiOperationOptions): Promise<unknown[]> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListDockerVolumes' as never, { server: serverId } as never);
    return (response as unknown[]) || [];
  }

  /**
   * Inspects a specific Docker volume to get detailed information.
   *
   * @param serverId - The ID of the server where the volume exists
   * @param volume - The volume name to inspect
   * @param options - Operation options including abort signal
   * @returns Detailed volume information
   * @throws ZodError if serverId is invalid
   * @throws Error on API failure or cancellation
   */
  async inspect(serverId: string, volume: string, options?: ApiOperationOptions): Promise<unknown> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    const response = await this.client.read('InspectDockerVolume' as never, { server: serverId, volume } as never);
    return response;
  }

  /**
   * Deletes a Docker volume from a server.
   *
   * @param serverId - The ID of the server to delete the volume from
   * @param name - The volume name to delete
   * @param options - Operation options including abort signal
   * @returns The deletion result
   * @throws ZodError if serverId is invalid
   * @throws Error on API failure or cancellation
   */
  async delete(serverId: string, name: string, options?: ApiOperationOptions): Promise<unknown> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    const response = await this.client.execute('DeleteVolume' as never, { server: serverId, name } as never);
    return response;
  }
}
