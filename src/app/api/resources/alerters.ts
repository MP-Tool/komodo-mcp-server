/**
 * Alerter Resource
 *
 * Provides operations for managing Alerters in Komodo.
 * Alerters handle notification routing to Slack, Discord, ntfy, Gotify, and custom webhooks.
 *
 * @module app/api/resources/alerters
 */

import { BaseResource } from '../base.js';
import { validateResourceName } from '../utils.js';
import type { ApiOperationOptions } from '../base.js';
import type { Types } from 'komodo_client';

type AlerterListItem = Types.AlerterListItem;
type Alerter = Types.Alerter;
type AlerterConfig = Types.AlerterConfig;
type Update = Types.Update;

/**
 * Resource for managing Alerters.
 */
export class AlerterResource extends BaseResource {
  async list(options?: ApiOperationOptions): Promise<AlerterListItem[]> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListAlerters', {});
    return response || [];
  }

  async get(alerterId: string, options?: ApiOperationOptions): Promise<Alerter> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('GetAlerter', { alerter: alerterId });
    return response;
  }

  async create(name: string, config?: Partial<AlerterConfig>, options?: ApiOperationOptions): Promise<Alerter> {
    validateResourceName(name);
    this.checkAborted(options?.signal);
    const response = await this.client.write('CreateAlerter', { name, config });
    return response;
  }

  async update(alerterId: string, config: Partial<AlerterConfig>, options?: ApiOperationOptions): Promise<Alerter> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('UpdateAlerter', { id: alerterId, config });
    return response;
  }

  async delete(alerterId: string, options?: ApiOperationOptions): Promise<Alerter> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('DeleteAlerter', { id: alerterId });
    return response;
  }

  async test(alerterId: string, options?: ApiOperationOptions): Promise<Update> {
    this.checkAborted(options?.signal);
    const response = await this.client.execute('TestAlerter', { alerter: alerterId });
    return response;
  }
}
