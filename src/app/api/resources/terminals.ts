/**
 * Terminal Resource
 *
 * Provides operations for managing terminal sessions on Komodo servers.
 * Supports listing, creating, and deleting terminal sessions.
 *
 * @module app/api/resources/terminals
 */

import { BaseResource } from '../base.js';
import { validateServerId } from '../utils.js';
import type { ApiOperationOptions } from '../base.js';

/**
 * Resource for managing terminal sessions on servers.
 */
export class TerminalResource extends BaseResource {
  /**
   * Lists all terminal sessions on a specific server.
   *
   * @param serverId - The ID of the server to list terminals from
   * @param fresh - Whether to force a fresh query (bypass cache)
   * @param options - Operation options including abort signal
   * @returns A list of terminal sessions
   * @throws ZodError if serverId is invalid
   * @throws Error on API failure or cancellation
   */
  async list(serverId: string, fresh?: boolean, options?: ApiOperationOptions): Promise<unknown> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = { server: serverId };
    if (fresh !== undefined) params.fresh = fresh;
    return await this.client.read('ListTerminals' as never, params as never);
  }

  /**
   * Creates a new terminal session on a server.
   *
   * @param serverId - The ID of the server to create the terminal on
   * @param name - Name for the terminal session
   * @param command - Optional command to run in the terminal
   * @param recreate - Whether to recreate if a terminal with the same name exists
   * @param options - Operation options including abort signal
   * @returns The created terminal session
   * @throws ZodError if serverId is invalid
   * @throws Error on API failure or cancellation
   */
  async create(
    serverId: string,
    name: string,
    command?: string,
    recreate?: boolean,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = { server: serverId, name };
    if (command) params.command = command;
    if (recreate !== undefined) params.recreate = recreate;
    return await this.client.write('CreateTerminal' as never, params as never);
  }

  /**
   * Deletes a specific terminal session on a server.
   *
   * @param serverId - The ID of the server where the terminal is running
   * @param terminal - The name or ID of the terminal to delete
   * @param options - Operation options including abort signal
   * @returns The result of the delete operation
   * @throws ZodError if serverId is invalid
   * @throws Error on API failure or cancellation
   */
  async delete(serverId: string, terminal: string, options?: ApiOperationOptions): Promise<unknown> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    return await this.client.write('DeleteTerminal' as never, { server: serverId, terminal } as never);
  }

  /**
   * Deletes all terminal sessions on a server.
   *
   * @param serverId - The ID of the server to delete all terminals from
   * @param options - Operation options including abort signal
   * @returns The result of the delete operation
   * @throws ZodError if serverId is invalid
   * @throws Error on API failure or cancellation
   */
  async deleteAll(serverId: string, options?: ApiOperationOptions): Promise<unknown> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    return await this.client.write('DeleteAllTerminals' as never, { server: serverId } as never);
  }
}
