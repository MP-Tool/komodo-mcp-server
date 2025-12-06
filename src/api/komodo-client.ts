import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger as baseLogger } from '../utils/logger.js';

const logger = baseLogger.child({ component: 'api' });

// ===== Komodo API Types =====
// Based on the official Komodo TypeScript client (v1.19.0+)
// These types are aligned with the Komodo Core API response structures

/**
 * Mongo ObjectId structure used by Komodo API
 */
export interface MongoId {
  $oid: string;
}

/**
 * Server state enum
 */
export type ServerState = 'Ok' | 'NotOk' | 'Disabled';

/**
 * Update status enum
 */
export type UpdateStatus = 'Queued' | 'InProgress' | 'Complete';

/**
 * Container information returned by Komodo API
 */
export interface KomodoContainer {
  name: string;
  state: string;
  image?: string;
  status?: string;
  ports?: string[];
  created?: string;
  image_id?: string;
}

/**
 * Server list item returned by ListServers
 */
export interface KomodoServer {
  id: string;
  name: string;
  template: boolean;
  tags: string[];
  info: {
    state: ServerState;
    region: string;
    address: string;
    external_address?: string;
    version: string;
    send_unreachable_alerts: boolean;
    send_cpu_alerts: boolean;
    send_mem_alerts: boolean;
    send_disk_alerts: boolean;
    send_version_mismatch_alerts: boolean;
    terminals_disabled: boolean;
    container_exec_disabled: boolean;
  };
}

/**
 * Server state response from GetServerState
 */
export interface KomodoServerState {
  status: ServerState;
}

/**
 * Deployment list item
 */
export interface KomodoDeployment {
  id: string;
  name: string;
  state?: 'Running' | 'Stopped' | 'Building' | 'Unknown';
  server_id?: string;
  image?: string;
}

/**
 * Stack list item
 */
export interface KomodoStack {
  id: string;
  name: string;
  info: {
    state: 'Unknown' | 'Running' | 'Stopped' | 'Restarting' | 'Paused' | 'Exited';
  };
  server_id?: string;
}

/**
 * Update object returned by execute operations
 * Represents an action performed by Komodo
 */
export interface KomodoUpdate {
  _id?: MongoId;
  operation: string;
  start_ts: number;
  success: boolean;
  operator: string;
  target: {
    type: string;
    id: string;
  };
  logs: Array<{
    ts: number;
    message: string;
  }>;
  end_ts?: number;
  status: UpdateStatus;
  version?: {
    major: number;
    minor: number;
    patch: number;
  };
  commit_hash?: string;
}

/**
 * Structured error from Komodo API
 */
export interface KomodoApiError {
  message: string;
  code?: number;
  details?: any;
}

/**
 * Helper function to extract Update ID from Mongo ObjectId
 */
export function extractUpdateId(update: KomodoUpdate): string {
  return update._id?.$oid || 'unknown';
}

/**
 * Komodo Container Manager API Client
 * Provides comprehensive container management operations
 */
export class KomodoClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private jwt: string;

  private constructor(baseUrl: string, jwt: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.jwt = jwt;

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'authorization': this.jwt, // Komodo uses lowercase 'authorization' with JWT directly
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000, // 30 seconds timeout
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        logger.error('Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          const errorData = error.response.data as any;
          logger.error(`API Error ${error.response.status}: ${errorData?.message || error.message}`);
          
          // Create structured error
          const komodoError: KomodoApiError = {
            message: errorData?.message || error.message || 'Unknown API error',
            code: error.response.status,
            details: errorData
          };
          
          throw komodoError;
        } else if (error.request) {
          logger.error('Network Error:', error.message);
          throw {
            message: `Network error: ${error.message}. Please check if Komodo server is running at ${this.baseUrl}`,
            code: 0
          } as KomodoApiError;
        } else {
          logger.error('API Error:', error);
          throw {
            message: error.message || 'Unknown error',
            code: -1
          } as KomodoApiError;
        }
      }
    );
  }

  /**
   * Create a new KomodoClient by logging in with username and password
   * This will automatically obtain a JWT token from the Komodo Core server
   */
  static async login(baseUrl: string, username: string, password: string): Promise<KomodoClient> {
    const url = baseUrl.replace(/\/$/, '');
    
    try {
      logger.debug(`Logging in as ${username} to ${url}`);
      
      // Login to get JWT token
      const response = await axios.post(`${url}/auth/LoginLocalUser`, {
        username,
        password
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000
      });

      if (!response.data.jwt) {
        throw new Error('Login successful but no JWT token received');
      }

      const jwt = response.data.jwt;
      logger.debug('✅ Login successful, JWT obtained');
      
      return new KomodoClient(url, jwt);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          const status = error.response.status;
          if (status === 401 || status === 403) {
            throw new Error('Login failed: Invalid username or password');
          }
          throw new Error(`Login failed: HTTP ${status} - ${error.response.data?.error || error.message}`);
        } else if (error.request) {
          throw new Error(`Cannot reach Komodo server at ${url}. Please check if the server is running.`);
        }
      }
      throw new Error(`Login failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Comprehensive health check of the Komodo server connection
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    message: string;
    details: {
      url: string;
      reachable: boolean;
      authenticated: boolean;
      apiVersion?: string;
      responseTime?: number;
      error?: string;
    };
  }> {
    const startTime = Date.now();
    const details = {
      url: this.baseUrl,
      reachable: false,
      authenticated: false,
      responseTime: 0,
    };

    try {
      logger.debug(`Testing connection to ${this.baseUrl}`);
      
      // Try to get server summary as a connection test
      // Komodo API: POST /read/GetServersSummary with params as body
      const response = await this.client.post('/read/GetServersSummary', {});
      
      details.responseTime = Date.now() - startTime;
      details.reachable = true;
      details.authenticated = true;
      
      logger.debug(`✅ Healthy (${details.responseTime}ms)`);
      
      return {
        status: 'healthy',
        message: `Successfully connected to Komodo server at ${this.baseUrl}`,
        details: {
          ...details,
          apiVersion: response.data?.version || 'unknown'
        }
      };
      
    } catch (error) {
      details.responseTime = Date.now() - startTime;
      
      // Analyze the error type
      if (error && typeof error === 'object' && 'code' in error) {
        const komodoError = error as KomodoApiError;
        
        // Check specific error codes
        if (komodoError.code === 401 || komodoError.code === 403) {
          logger.warn('❌ Authentication failed');
          return {
            status: 'unhealthy',
            message: 'Authentication failed - check your KOMODO_JWT_SECRET',
            details: {
              ...details,
              reachable: true,
              authenticated: false,
              error: `HTTP ${komodoError.code}: ${komodoError.message}`
            }
          };
        }
        
        if (komodoError.code === 0) {
          logger.warn('❌ Server unreachable');
          return {
            status: 'unhealthy',
            message: `Cannot reach Komodo server at ${this.baseUrl}`,
            details: {
              ...details,
              error: komodoError.message
            }
          };
        }
        
        logger.error(`❌ API Error: ${komodoError.message}`);
        return {
          status: 'unhealthy',
          message: 'Komodo API returned an error',
          details: {
            ...details,
            reachable: true,
            error: `HTTP ${komodoError.code}: ${komodoError.message}`
          }
        };
      }
      
      logger.error('❌ Unknown error:', error);
      return {
        status: 'unhealthy',
        message: 'Unknown error occurred',
        details: {
          ...details,
          error: String(error)
        }
      };
    }
  }

  // ===== SERVER MANAGEMENT =====

  /**
   * List all servers
   */
  async listServers(): Promise<KomodoServer[]> {
    try {
      const response = await this.client.post('/read/ListServers', {});
      return response.data || [];
    } catch (error) {
      logger.error('Failed to list servers:', error);
      return [];
    }
  }

  /**
   * Get server state and information
   */
  async getServerState(serverId: string): Promise<KomodoServerState> {
    try {
      const response = await this.client.post('/read/GetServerState', { server: serverId });
      return response.data || { status: 'NotOk' };
    } catch (error) {
      logger.error(`Failed to get server state for ${serverId}:`, error);
      return { status: 'NotOk' };
    }
  }

  // ===== CONTAINER MANAGEMENT =====

  /**
   * List all Docker containers on a server
   */
  async listDockerContainers(serverId: string): Promise<KomodoContainer[]> {
    try {
      const response = await this.client.post('/read/ListDockerContainers', { server: serverId });
      return response.data || [];
    } catch (error) {
      logger.error(`Failed to list containers for server ${serverId}:`, error);
      return [];
    }
  }

  /**
   * Start a Docker container
   */
  async startContainer(serverId: string, containerName: string): Promise<KomodoUpdate> {
    try {
      const response = await this.client.post('/execute/StartContainer', {
        server: serverId,
        container: containerName
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to start container ${containerName} on server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Stop a Docker container
   */
  async stopContainer(serverId: string, containerName: string): Promise<KomodoUpdate> {
    try {
      const response = await this.client.post('/execute/StopContainer', {
        server: serverId,
        container: containerName
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to stop container ${containerName} on server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Restart a Docker container
   */
  async restartContainer(serverId: string, containerName: string): Promise<KomodoUpdate> {
    try {
      const response = await this.client.post('/execute/RestartContainer', {
        server: serverId,
        container: containerName
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to restart container ${containerName} on server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Pause a Docker container
   */
  async pauseContainer(serverId: string, containerName: string): Promise<KomodoUpdate> {
    try {
      const response = await this.client.post('/execute/PauseContainer', {
        server: serverId,
        container: containerName
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to pause container ${containerName} on server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * Unpause a Docker container
   */
  async unpauseContainer(serverId: string, containerName: string): Promise<KomodoUpdate> {
    try {
      const response = await this.client.post('/execute/UnpauseContainer', {
        server: serverId,
        container: containerName
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to unpause container ${containerName} on server ${serverId}:`, error);
      throw error;
    }
  }

  // ===== DEPLOYMENT MANAGEMENT =====

  /**
   * List all deployments
   */
  async listDeployments(): Promise<KomodoDeployment[]> {
    try {
      const response = await this.client.post('/read/ListDeployments', {});
      return response.data || [];
    } catch (error) {
      logger.error('Failed to list deployments:', error);
      return [];
    }
  }

  /**
   * Deploy a container (deployment)
   */
  async deployContainer(deploymentId: string): Promise<KomodoUpdate> {
    try {
      const response = await this.client.post('/execute/Deploy', {
        deployment: deploymentId
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to deploy container ${deploymentId}:`, error);
      throw error;
    }
  }

  // ===== STACK MANAGEMENT =====

  /**
   * List all Docker Compose stacks
   */
  async listStacks(): Promise<KomodoStack[]> {
    try {
      const response = await this.client.post('/read/ListStacks', {});
      return response.data || [];
    } catch (error) {
      logger.error('Failed to list stacks:', error);
      return [];
    }
  }

  /**
   * Deploy a Docker Compose stack
   */
  async deployStack(stackId: string): Promise<KomodoUpdate> {
    try {
      const response = await this.client.post('/execute/DeployStack', {
        stack: stackId
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to deploy stack ${stackId}:`, error);
      throw error;
    }
  }

  /**
   * Stop a Docker Compose stack
   */
  async stopStack(stackId: string): Promise<KomodoUpdate> {
    try {
      const response = await this.client.post('/execute/StopStack', {
        stack: stackId
      });
      return response.data;
    } catch (error) {
      logger.error(`Failed to stop stack ${stackId}:`, error);
      throw error;
    }
  }
}