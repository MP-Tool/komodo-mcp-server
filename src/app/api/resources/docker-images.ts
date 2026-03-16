/**
 * Docker Image Resource
 *
 * Provides operations for managing Docker images on Komodo servers.
 * Supports listing, inspection, history, and deletion.
 *
 * @module app/api/resources/docker-images
 */

import { BaseResource } from '../base.js';
import { validateServerId } from '../utils.js';
import type { ApiOperationOptions } from '../base.js';

/**
 * Resource for managing Docker images on servers.
 */
export class DockerImageResource extends BaseResource {
  /**
   * Lists all Docker images on a specific server.
   *
   * @param serverId - The ID of the server to list images from
   * @param options - Operation options including abort signal
   * @returns A list of image items
   * @throws ZodError if serverId is invalid
   * @throws Error on API failure or cancellation
   */
  async list(serverId: string, options?: ApiOperationOptions): Promise<unknown[]> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListDockerImages' as never, { server: serverId } as never);
    return (response as unknown[]) || [];
  }

  /**
   * Inspects a specific Docker image to get detailed information.
   *
   * @param serverId - The ID of the server where the image exists
   * @param image - The image name or ID to inspect
   * @param options - Operation options including abort signal
   * @returns Detailed image information
   * @throws ZodError if serverId is invalid
   * @throws Error on API failure or cancellation
   */
  async inspect(serverId: string, image: string, options?: ApiOperationOptions): Promise<unknown> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    const response = await this.client.read('InspectDockerImage' as never, { server: serverId, image } as never);
    return response;
  }

  /**
   * Gets the layer history of a Docker image.
   *
   * @param serverId - The ID of the server where the image exists
   * @param image - The image name or ID to get history for
   * @param options - Operation options including abort signal
   * @returns The image layer history
   * @throws ZodError if serverId is invalid
   * @throws Error on API failure or cancellation
   */
  async history(serverId: string, image: string, options?: ApiOperationOptions): Promise<unknown> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListDockerImageHistory' as never, { server: serverId, image } as never);
    return response;
  }

  /**
   * Deletes a Docker image from a server.
   *
   * @param serverId - The ID of the server to delete the image from
   * @param name - The image name or ID to delete
   * @param options - Operation options including abort signal
   * @returns The deletion result
   * @throws ZodError if serverId is invalid
   * @throws Error on API failure or cancellation
   */
  async delete(serverId: string, name: string, options?: ApiOperationOptions): Promise<unknown> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    const response = await this.client.execute('DeleteImage' as never, { server: serverId, name } as never);
    return response;
  }
}
