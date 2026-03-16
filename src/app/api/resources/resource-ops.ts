/**
 * Resource Operations Resource
 *
 * Provides generic copy and rename operations for all Komodo resource types.
 * Uses the core client's write API with type casts to support the full set
 * of CopyX / RenameX endpoints.
 *
 * @module app/api/resources/resource-ops
 */

import { BaseResource } from '../base.js';
import type { ApiOperationOptions } from '../base.js';

/**
 * Resource types that support copy and rename operations.
 */
export type CopyableResource =
  | 'Server'
  | 'Deployment'
  | 'Stack'
  | 'Build'
  | 'Builder'
  | 'Repo'
  | 'ResourceSync'
  | 'Action'
  | 'Procedure'
  | 'Alerter';

/**
 * Resource for copy and rename operations on Komodo resources.
 */
export class ResourceOpsResource extends BaseResource {
  /**
   * Copies a resource with a new name.
   *
   * @param resourceType - The type of resource to copy
   * @param id - The ID of the resource to copy
   * @param newName - The name for the new copy
   * @param options - Operation options including abort signal
   * @returns The created copy
   * @throws Error on API failure or cancellation
   */
  async copy(
    resourceType: CopyableResource,
    id: string,
    newName: string,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write(`Copy${resourceType}` as never, { name: newName, id } as never);
  }

  /**
   * Renames an existing resource.
   *
   * @param resourceType - The type of resource to rename
   * @param id - The ID of the resource to rename
   * @param newName - The new name for the resource
   * @param options - Operation options including abort signal
   * @returns The renamed resource
   * @throws Error on API failure or cancellation
   */
  async rename(
    resourceType: CopyableResource,
    id: string,
    newName: string,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write(`Rename${resourceType}` as never, { id, name: newName } as never);
  }
}
