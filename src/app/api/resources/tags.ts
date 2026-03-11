/**
 * Tag Resource
 *
 * Provides operations for managing Tags in Komodo.
 * Tags are used to organize and filter resources.
 *
 * @module app/api/resources/tags
 */

import { BaseResource } from '../base.js';
import type { ApiOperationOptions } from '../base.js';

/**
 * Resource for managing Tags.
 */
export class TagResource extends BaseResource {
  async list(options?: ApiOperationOptions): Promise<unknown[]> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListTags', {});
    return response || [];
  }

  async get(tagId: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('GetTag', { tag: tagId });
    return response;
  }

  async create(name: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('CreateTag', { name });
    return response;
  }

  async delete(tagId: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('DeleteTag', { id: tagId });
    return response;
  }

  async rename(tagId: string, name: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('RenameTag', { id: tagId, name });
    return response;
  }
}
