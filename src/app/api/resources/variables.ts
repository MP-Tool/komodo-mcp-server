/**
 * Variable Resource
 *
 * Provides operations for managing Variables in Komodo.
 * Variables are key-value pairs used for configuration templating.
 *
 * @module app/api/resources/variables
 */

import { BaseResource } from '../base.js';
import type { ApiOperationOptions } from '../base.js';

/**
 * Resource for managing Variables.
 */
export class VariableResource extends BaseResource {
  async list(options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListVariables', {});
    return response;
  }

  async get(name: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('GetVariable', { name });
    return response;
  }

  async create(name: string, value: string, description?: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('CreateVariable', { name, value, description: description || '' });
    return response;
  }

  async updateValue(name: string, value: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('UpdateVariableValue', { name, value });
    return response;
  }

  async updateDescription(name: string, description: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('UpdateVariableDescription', { name, description });
    return response;
  }

  async delete(name: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('DeleteVariable', { name });
    return response;
  }
}
