/**
 * Action Resource
 *
 * Provides operations for managing Actions in Komodo.
 * Actions are TypeScript scripts that run with a pre-authenticated Komodo client.
 *
 * @module app/api/resources/actions
 */

import { BaseResource } from '../base.js';
import { validateResourceName } from '../utils.js';
import type { ApiOperationOptions } from '../base.js';
import type { Types } from 'komodo_client';

type ActionListItem = Types.ActionListItem;
type Action = Types.Action;
type ActionConfig = Types.ActionConfig;
type Update = Types.Update;

/**
 * Resource for managing Actions.
 */
export class ActionResource extends BaseResource {
  async list(options?: ApiOperationOptions): Promise<ActionListItem[]> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListActions', {});
    return response || [];
  }

  async get(actionId: string, options?: ApiOperationOptions): Promise<Action> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('GetAction', { action: actionId });
    return response;
  }

  async create(name: string, config?: Partial<ActionConfig>, options?: ApiOperationOptions): Promise<Action> {
    validateResourceName(name);
    this.checkAborted(options?.signal);
    const response = await this.client.write('CreateAction', { name, config: config as never });
    return response;
  }

  async update(actionId: string, config: Partial<ActionConfig>, options?: ApiOperationOptions): Promise<Action> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('UpdateAction', { id: actionId, config: config as never });
    return response;
  }

  async delete(actionId: string, options?: ApiOperationOptions): Promise<Action> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('DeleteAction', { id: actionId });
    return response;
  }

  async run(actionId: string, options?: ApiOperationOptions): Promise<Update> {
    this.checkAborted(options?.signal);
    const response = await this.client.execute('RunAction', { action: actionId });
    return response;
  }
}
