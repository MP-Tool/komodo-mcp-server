/**
 * Generic API Client Interface
 *
 * Framework-agnostic interface that any API client must implement
 * to work with the MCP server connection management.
 *
 * @module server/types/client
 */

// ============================================================================
// Health Check Types
// ============================================================================

/**
 * Health status values
 */
export type HealthStatus = 'healthy' | 'unhealthy';

/**
 * Health check result from an API client.
 *
 * @example
 * ```typescript
 * const result: IHealthCheckResult = {
 *   status: 'healthy',
 *   message: 'Connection established',
 *   details: { responseTime: 42 }
 * };
 * ```
 */
export interface IHealthCheckResult {
  /** Health status of the API client */
  readonly status: HealthStatus;

  /** Optional human-readable message */
  readonly message?: string;

  /** Optional additional details for debugging (extensible) */
  readonly details?: {
    [key: string]: unknown;
  };
}

// ============================================================================
// API Client Interface
// ============================================================================

/**
 * Generic API client interface for connection management.
 *
 * This interface defines the minimum contract that any API client
 * must implement to work with the MCP server framework's connection
 * state management and tool execution.
 *
 * @example
 * ```typescript
 * class MyApiClient implements IApiClient {
 *   readonly clientType = 'my-api';
 *
 *   async healthCheck(): Promise<IHealthCheckResult> {
 *     try {
 *       await this.ping();
 *       return { status: 'healthy' };
 *     } catch (error) {
 *       return { status: 'unhealthy', message: error.message };
 *     }
 *   }
 * }
 * ```
 */
export interface IApiClient {
  /**
   * Unique identifier for the client type.
   * Used for logging and telemetry attribution.
   *
   * @example 'komodo', 'docker', 'kubernetes'
   */
  readonly clientType: string;

  /**
   * Performs a health check to verify connectivity.
   *
   * This method is called:
   * - During initial connection to validate credentials
   * - Periodically to monitor connection health
   * - On reconnection attempts
   *
   * Implementations should:
   * - Make a lightweight API call (e.g., ping, version check)
   * - Return quickly (timeout recommended: 5-10 seconds)
   * - NOT throw errors - return unhealthy status instead
   *
   * @returns Health check result with status and optional details
   */
  healthCheck(): Promise<IHealthCheckResult>;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if an object implements IApiClient.
 *
 * @param obj - Object to check
 * @returns True if obj implements IApiClient interface
 *
 * @example
 * ```typescript
 * if (isApiClient(maybeClient)) {
 *   const result = await maybeClient.healthCheck();
 * }
 * ```
 */
export function isApiClient(obj: unknown): obj is IApiClient {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'clientType' in obj &&
    typeof (obj as IApiClient).clientType === 'string' &&
    'healthCheck' in obj &&
    typeof (obj as IApiClient).healthCheck === 'function'
  );
}

// ============================================================================
// Factory Types
// ============================================================================

/**
 * Factory function type for creating API clients.
 * Used for dependency injection and testing.
 *
 * @typeParam TClient - The API client type to create
 * @typeParam TConfig - Configuration type for client creation
 */
export type ApiClientFactory<TClient extends IApiClient, TConfig = unknown> = (config: TConfig) => Promise<TClient>;
