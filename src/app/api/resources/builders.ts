/**
 * Builder Resource
 *
 * Provides operations for managing Builders in Komodo.
 * Builders are the build environments used by Builds to create Docker images.
 *
 * @module app/api/resources/builders
 */

import { BaseResource } from '../base.js';
import { validateResourceName } from '../utils.js';
import type { ApiOperationOptions } from '../base.js';
import type { Types } from 'komodo_client';

type BuilderListItem = Types.BuilderListItem;
type Builder = Types.Builder;
type BuilderConfig = Types.BuilderConfig;

/**
 * Resource for managing Builders.
 */
export class BuilderResource extends BaseResource {
  async list(options?: ApiOperationOptions): Promise<BuilderListItem[]> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListBuilders', {});
    return response || [];
  }

  async get(builderId: string, options?: ApiOperationOptions): Promise<Builder> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('GetBuilder', { builder: builderId });
    return response;
  }

  async create(name: string, config?: Partial<BuilderConfig>, options?: ApiOperationOptions): Promise<Builder> {
    validateResourceName(name);
    this.checkAborted(options?.signal);
    const response = await this.client.write('CreateBuilder', { name, config });
    return response;
  }

  async update(builderId: string, config: Partial<BuilderConfig>, options?: ApiOperationOptions): Promise<Builder> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('UpdateBuilder', { id: builderId, config });
    return response;
  }

  async delete(builderId: string, options?: ApiOperationOptions): Promise<Builder> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('DeleteBuilder', { id: builderId });
    return response;
  }
}
