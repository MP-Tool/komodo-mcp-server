/**
 * Provider Resource
 *
 * Provides operations for managing Git provider accounts and
 * Docker registry accounts in Komodo.
 *
 * @module app/api/resources/providers
 */

import { BaseResource } from '../base.js';
import type { ApiOperationOptions } from '../base.js';

/**
 * Resource for managing Git and Docker registry provider accounts.
 */
export class ProviderResource extends BaseResource {
  // ── Git Provider Accounts ──────────────────────────────────────────

  /**
   * Lists git provider accounts with optional filters.
   *
   * @param domain - Optional domain filter
   * @param username - Optional username filter
   * @param options - Operation options including abort signal
   * @returns List of git provider accounts
   */
  async listGitProviderAccounts(domain?: string, username?: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = {};
    if (domain !== undefined) params.domain = domain;
    if (username !== undefined) params.username = username;
    return await this.client.read('ListGitProviderAccounts' as never, params as never);
  }

  /**
   * Gets a specific git provider account.
   *
   * @param id - Account ID
   * @param options - Operation options including abort signal
   * @returns The git provider account details
   */
  async getGitProviderAccount(id: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.read('GetGitProviderAccount' as never, { id } as never);
  }

  /**
   * Creates a new git provider account.
   *
   * @param domain - Git provider domain
   * @param username - Git username
   * @param token - Authentication token
   * @param options - Operation options including abort signal
   * @returns The created account
   */
  async createGitProviderAccount(
    domain: string,
    username: string,
    token: string,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write(
      'CreateGitProviderAccount' as never,
      {
        domain,
        username,
        token,
      } as never,
    );
  }

  /**
   * Updates an existing git provider account.
   *
   * @param id - Account ID
   * @param domain - Optional new domain
   * @param username - Optional new username
   * @param token - Optional new token
   * @param options - Operation options including abort signal
   * @returns The updated account
   */
  async updateGitProviderAccount(
    id: string,
    domain?: string,
    username?: string,
    token?: string,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = { id };
    if (domain !== undefined) params.domain = domain;
    if (username !== undefined) params.username = username;
    if (token !== undefined) params.token = token;
    return await this.client.write('UpdateGitProviderAccount' as never, params as never);
  }

  /**
   * Deletes a git provider account.
   *
   * @param id - Account ID
   * @param options - Operation options including abort signal
   * @returns The deletion result
   */
  async deleteGitProviderAccount(id: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write('DeleteGitProviderAccount' as never, { id } as never);
  }

  // ── Docker Registry Accounts ───────────────────────────────────────

  /**
   * Lists docker registry accounts with optional filters.
   *
   * @param domain - Optional domain filter
   * @param username - Optional username filter
   * @param options - Operation options including abort signal
   * @returns List of docker registry accounts
   */
  async listDockerRegistryAccounts(
    domain?: string,
    username?: string,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = {};
    if (domain !== undefined) params.domain = domain;
    if (username !== undefined) params.username = username;
    return await this.client.read('ListDockerRegistryAccounts' as never, params as never);
  }

  /**
   * Gets a specific docker registry account.
   *
   * @param id - Account ID
   * @param options - Operation options including abort signal
   * @returns The docker registry account details
   */
  async getDockerRegistryAccount(id: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.read('GetDockerRegistryAccount' as never, { id } as never);
  }

  /**
   * Creates a new docker registry account.
   *
   * @param domain - Registry domain
   * @param username - Registry username
   * @param password - Registry password
   * @param options - Operation options including abort signal
   * @returns The created account
   */
  async createDockerRegistryAccount(
    domain: string,
    username: string,
    password: string,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write(
      'CreateDockerRegistryAccount' as never,
      {
        domain,
        username,
        password,
      } as never,
    );
  }

  /**
   * Updates an existing docker registry account.
   *
   * @param id - Account ID
   * @param domain - Optional new domain
   * @param username - Optional new username
   * @param password - Optional new password
   * @param options - Operation options including abort signal
   * @returns The updated account
   */
  async updateDockerRegistryAccount(
    id: string,
    domain?: string,
    username?: string,
    password?: string,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = { id };
    if (domain !== undefined) params.domain = domain;
    if (username !== undefined) params.username = username;
    if (password !== undefined) params.password = password;
    return await this.client.write('UpdateDockerRegistryAccount' as never, params as never);
  }

  /**
   * Deletes a docker registry account.
   *
   * @param id - Account ID
   * @param options - Operation options including abort signal
   * @returns The deletion result
   */
  async deleteDockerRegistryAccount(id: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write('DeleteDockerRegistryAccount' as never, { id } as never);
  }
}
