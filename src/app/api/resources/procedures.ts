/**
 * Procedure Resource
 *
 * Provides operations for managing Procedures in Komodo.
 * Procedures are multi-step workflows with parallel stages and sequential ordering.
 *
 * @module app/api/resources/procedures
 */

import { BaseResource } from '../base.js';
import { validateResourceName } from '../utils.js';
import type { ApiOperationOptions } from '../base.js';
import type { Types } from 'komodo_client';

type ProcedureListItem = Types.ProcedureListItem;
type Procedure = Types.Procedure;
type ProcedureConfig = Types.ProcedureConfig;
type Update = Types.Update;

/**
 * Resource for managing Procedures.
 */
export class ProcedureResource extends BaseResource {
  async list(options?: ApiOperationOptions): Promise<ProcedureListItem[]> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListProcedures', {});
    return response || [];
  }

  async get(procedureId: string, options?: ApiOperationOptions): Promise<Procedure> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('GetProcedure', { procedure: procedureId });
    return response;
  }

  async create(name: string, config?: Partial<ProcedureConfig>, options?: ApiOperationOptions): Promise<Procedure> {
    validateResourceName(name);
    this.checkAborted(options?.signal);
    const response = await this.client.write('CreateProcedure', { name, config });
    return response;
  }

  async update(procedureId: string, config: Partial<ProcedureConfig>, options?: ApiOperationOptions): Promise<Procedure> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('UpdateProcedure', { id: procedureId, config });
    return response;
  }

  async delete(procedureId: string, options?: ApiOperationOptions): Promise<Procedure> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('DeleteProcedure', { id: procedureId });
    return response;
  }

  async run(procedureId: string, options?: ApiOperationOptions): Promise<Update> {
    this.checkAborted(options?.signal);
    const response = await this.client.execute('RunProcedure', { procedure: procedureId });
    return response;
  }
}
