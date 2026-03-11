/**
 * Build Resource
 *
 * Provides operations for managing Builds in Komodo.
 * Builds are Docker image builds from git with auto-versioning, webhook triggers, and registry push.
 *
 * @module app/api/resources/builds
 */

import { BaseResource } from '../base.js';
import { validateResourceName } from '../utils.js';
import type { ApiOperationOptions } from '../base.js';
import type { Types } from 'komodo_client';

type BuildListItem = Types.BuildListItem;
type Build = Types.Build;
type BuildConfig = Types.BuildConfig;
type Update = Types.Update;

/**
 * Resource for managing Builds.
 */
export class BuildResource extends BaseResource {
  async list(options?: ApiOperationOptions): Promise<BuildListItem[]> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListBuilds', {});
    return response || [];
  }

  async get(buildId: string, options?: ApiOperationOptions): Promise<Build> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('GetBuild', { build: buildId });
    return response;
  }

  async create(name: string, config?: Partial<BuildConfig>, options?: ApiOperationOptions): Promise<Build> {
    validateResourceName(name);
    this.checkAborted(options?.signal);
    const response = await this.client.write('CreateBuild', { name, config });
    return response;
  }

  async update(buildId: string, config: Partial<BuildConfig>, options?: ApiOperationOptions): Promise<Build> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('UpdateBuild', { id: buildId, config });
    return response;
  }

  async delete(buildId: string, options?: ApiOperationOptions): Promise<Build> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('DeleteBuild', { id: buildId });
    return response;
  }

  async run(buildId: string, options?: ApiOperationOptions): Promise<Update> {
    this.checkAborted(options?.signal);
    const response = await this.client.execute('RunBuild', { build: buildId });
    return response;
  }

  async cancel(buildId: string, options?: ApiOperationOptions): Promise<Update> {
    this.checkAborted(options?.signal);
    const response = await this.client.execute('CancelBuild', { build: buildId });
    return response;
  }
}
