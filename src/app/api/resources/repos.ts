/**
 * Repo Resource
 *
 * Provides operations for managing Repos in Komodo.
 * Repos are git repositories managed by Komodo with clone, pull, and build capabilities.
 *
 * @module app/api/resources/repos
 */

import { BaseResource } from '../base.js';
import { validateResourceName } from '../utils.js';
import type { ApiOperationOptions } from '../base.js';
import type { Types } from 'komodo_client';

type RepoListItem = Types.RepoListItem;
type Repo = Types.Repo;
type RepoConfig = Types.RepoConfig;
type Update = Types.Update;

/**
 * Resource for managing Repos.
 */
export class RepoResource extends BaseResource {
  async list(options?: ApiOperationOptions): Promise<RepoListItem[]> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListRepos', {});
    return response || [];
  }

  async get(repoId: string, options?: ApiOperationOptions): Promise<Repo> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('GetRepo', { repo: repoId });
    return response;
  }

  async create(name: string, config?: Partial<RepoConfig>, options?: ApiOperationOptions): Promise<Repo> {
    validateResourceName(name);
    this.checkAborted(options?.signal);
    const response = await this.client.write('CreateRepo', { name, config });
    return response;
  }

  async update(repoId: string, config: Partial<RepoConfig>, options?: ApiOperationOptions): Promise<Repo> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('UpdateRepo', { id: repoId, config });
    return response;
  }

  async delete(repoId: string, options?: ApiOperationOptions): Promise<Repo> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('DeleteRepo', { id: repoId });
    return response;
  }

  async clone(repoId: string, options?: ApiOperationOptions): Promise<Update> {
    this.checkAborted(options?.signal);
    const response = await this.client.execute('CloneRepo', { repo: repoId });
    return response;
  }

  async pull(repoId: string, options?: ApiOperationOptions): Promise<Update> {
    this.checkAborted(options?.signal);
    const response = await this.client.execute('PullRepo', { repo: repoId });
    return response;
  }

  async build(repoId: string, options?: ApiOperationOptions): Promise<Update> {
    this.checkAborted(options?.signal);
    const response = await this.client.execute('BuildRepo', { repo: repoId });
    return response;
  }
}
