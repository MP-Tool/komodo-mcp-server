/**
 * API Module
 *
 * Provides the KomodoClient for interacting with the Komodo API.
 *
 * @module api
 */

import { KomodoClient as createKomodoClient } from 'komodo_client';
import { logger as baseLogger } from '../utils/index.js';
import { HealthCheckResult } from './types.js';
import { ServerResource, ContainerResource, StackResource, DeploymentResource } from './resources/index.js';

const logger = baseLogger.child({ component: 'api' });

export * from './types.js';
export * from './utils.js';
export type { ApiOperationOptions } from './base.js';

/**
 * Main client for interacting with the Komodo API.
 *
 * This class acts as a facade, providing access to various resources
 * (servers, containers, stacks, deployments) through a unified interface.
 * It handles authentication and connection management.
 */
export class KomodoClient {
  private client: ReturnType<typeof createKomodoClient>;
  private baseUrl: string;

  // Resources
  public readonly servers: ServerResource;
  public readonly containers: ContainerResource;
  public readonly stacks: StackResource;
  public readonly deployments: DeploymentResource;

  private constructor(baseUrl: string, client: ReturnType<typeof createKomodoClient>) {
    this.baseUrl = baseUrl;
    this.client = client;

    // Initialize resources
    this.servers = new ServerResource(client);
    this.containers = new ContainerResource(client);
    this.stacks = new StackResource(client);
    this.deployments = new DeploymentResource(client);
  }

  /**
   * Authenticates with the Komodo server using username and password.
   *
   * @param baseUrl - The base URL of the Komodo server (e.g., http://localhost:9120)
   * @param username - The username for authentication
   * @param password - The password for authentication
   * @returns A new instance of KomodoClient
   * @throws Error if login fails or no JWT is received
   */
  static async login(baseUrl: string, username: string, password: string): Promise<KomodoClient> {
    const url = baseUrl.replace(/\/$/, '');
    const { config } = await import('../config/index.js');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.API_TIMEOUT_MS);

    try {
      logger.debug('Authenticating user=%s url=%s', username, url);

      const response = await fetch(`${url}/auth/LoginLocalUser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Login failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as { jwt: string };
      if (!data.jwt) {
        throw new Error('Login successful but no JWT token received');
      }

      const client = createKomodoClient(url, {
        type: 'jwt',
        params: { jwt: data.jwt },
      });

      return new KomodoClient(url, client);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Login request timed out after ${config.API_TIMEOUT_MS}ms`);
      }
      logger.error('Login error:', error);
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Connects to the Komodo server using an API Key and Secret.
   *
   * @param baseUrl - The base URL of the Komodo server
   * @param key - The API Key
   * @param secret - The API Secret
   * @returns A new instance of KomodoClient
   */
  static connectWithApiKey(baseUrl: string, key: string, secret: string): KomodoClient {
    const url = baseUrl.replace(/\/$/, '');

    logger.debug('Connecting with API-Key to %s', url);

    const client = createKomodoClient(url, {
      type: 'api-key',
      params: { key, secret },
    });

    return new KomodoClient(url, client);
  }

  /**
   * Performs a health check on the connection to the Komodo server.
   *
   * @returns A HealthCheckResult object containing status and details
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const versionRes = await this.client.read('GetVersion', {});
      return {
        status: 'healthy',
        message: 'Connected',
        details: {
          url: this.baseUrl,
          reachable: true,
          authenticated: true,
          responseTime: Date.now() - startTime,
          apiVersion: versionRes.version,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: String(error),
        details: {
          url: this.baseUrl,
          reachable: false,
          authenticated: false,
          responseTime: Date.now() - startTime,
          error: String(error),
        },
      };
    }
  }
}
