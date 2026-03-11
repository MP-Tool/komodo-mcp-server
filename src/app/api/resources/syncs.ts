/**
 * ResourceSync Resource
 *
 * Provides operations for managing Resource Syncs in Komodo.
 * Resource Syncs enable GitOps: define infrastructure in TOML, push to git, Komodo auto-syncs.
 *
 * @module app/api/resources/syncs
 */

import { BaseResource } from '../base.js';
import { validateResourceName } from '../utils.js';
import type { ApiOperationOptions } from '../base.js';
import type { Types } from 'komodo_client';

type ResourceSyncListItem = Types.ResourceSyncListItem;
type ResourceSync = Types.ResourceSync;
type ResourceSyncConfig = Types.ResourceSyncConfig;
type Update = Types.Update;

/**
 * Resource for managing Resource Syncs.
 */
export class SyncResource extends BaseResource {
  async list(options?: ApiOperationOptions): Promise<ResourceSyncListItem[]> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListResourceSyncs', {});
    return response || [];
  }

  async get(syncId: string, options?: ApiOperationOptions): Promise<ResourceSync> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('GetResourceSync', { sync: syncId });
    return response;
  }

  async create(name: string, config?: Partial<ResourceSyncConfig>, options?: ApiOperationOptions): Promise<ResourceSync> {
    validateResourceName(name);
    this.checkAborted(options?.signal);
    const response = await this.client.write('CreateResourceSync', { name, config: config as never });
    return response;
  }

  async update(syncId: string, config: Partial<ResourceSyncConfig>, options?: ApiOperationOptions): Promise<ResourceSync> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('UpdateResourceSync', { id: syncId, config: config as never });
    return response;
  }

  async delete(syncId: string, options?: ApiOperationOptions): Promise<ResourceSync> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('DeleteResourceSync', { id: syncId });
    return response;
  }

  async run(syncId: string, options?: ApiOperationOptions): Promise<Update> {
    this.checkAborted(options?.signal);
    const response = await this.client.execute('RunSync', { sync: syncId });
    return response;
  }

  async commit(syncId: string, options?: ApiOperationOptions): Promise<Update> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('CommitSync', { sync: syncId });
    return response;
  }
}
