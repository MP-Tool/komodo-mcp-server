/**
 * Komodo Client
 *
 * Main client for interacting with the Komodo API.
 * Acts as a facade providing access to various resources
 * (servers, containers, stacks, deployments) through a unified interface.
 *
 * @module app/api/client
 */

import { KomodoClient as createKomodoClient } from 'komodo_client';
import { logger as baseLogger } from '../utils/index.js';
import { AuthenticationError, ConnectionError } from '../errors/index.js';
import type { IApiClient } from '../../server/types/index.js';
import { HealthCheckResult } from './types.js';
import { ServerResource, ContainerResource, StackResource, DeploymentResource } from './resources/index.js';

const logger = baseLogger.child({ component: 'KomodoClient' });

/**
 * Main client for interacting with the Komodo API.
 *
 * This class acts as a facade, providing access to various resources
 * (servers, containers, stacks, deployments) through a unified interface.
 * It handles authentication and connection management.
 *
 * Implements IApiClient for generic MCP server framework compatibility.
 *
 * @example
 * ```typescript
 * // Login with username/password
 * const client = await KomodoClient.login('http://localhost:9120', 'admin', 'password');
 *
 * // Or connect with API key
 * const client = KomodoClient.connectWithApiKey('http://localhost:9120', 'key', 'secret');
 *
 * // Use resources
 * const servers = await client.servers.list();
 * const containers = await client.containers.list('server-id');
 * ```
 */
export class KomodoClient implements IApiClient {
  /**
   * Client type identifier for IApiClient interface.
   * Used for logging and telemetry attribution.
   */
  readonly clientType = 'komodo' as const;

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
   * Gets the base URL of the connected Komodo server.
   */
  getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Authenticates with the Komodo server using username and password.
   *
   * @param baseUrl - The base URL of the Komodo server (e.g., http://localhost:9120)
   * @param username - The username for authentication
   * @param password - The password for authentication
   * @param timeoutMs - Optional timeout in milliseconds (default: 30000)
   * @returns A new instance of KomodoClient
   * @throws AuthenticationError if login fails or no JWT is received
   * @throws ConnectionError if connection times out
   */
  static async login(
    baseUrl: string,
    username: string,
    password: string,
    timeoutMs: number = 30_000,
  ): Promise<KomodoClient> {
    const url = baseUrl.replace(/\/$/, '');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      logger.debug('Authenticating user=%s url=%s', username, url);

      const response = await fetch(`${url}/auth/LoginLocalUser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw AuthenticationError.loginFailed(response.status, response.statusText);
      }

      const data = (await response.json()) as { jwt: string };
      if (!data.jwt) {
        throw AuthenticationError.noToken();
      }

      const client = createKomodoClient(url, {
        type: 'jwt',
        params: { jwt: data.jwt },
      });

      logger.info('Successfully authenticated to %s', url);
      return new KomodoClient(url, client);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw ConnectionError.timeout(url, timeoutMs);
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

    logger.info('Connected with API key to %s', url);
    return new KomodoClient(url, client);
  }

  /**
   * Performs a health check on the connection to the Komodo server.
   *
   * Implements IApiClient.healthCheck() for framework compatibility.
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
