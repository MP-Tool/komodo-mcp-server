/**
 * API Types Module
 *
 * Re-exports Komodo client types and defines API-specific types
 * for the application layer.
 *
 * @module app/api/types
 */

import { Types } from 'komodo_client';
import type { IHealthCheckResult } from '../framework.js';

// Re-export Types namespace for convenience
export { Types };

// Re-export ServerState enum
export const ServerState = Types.ServerState;

/**
 * Type alias for Update response.
 */
export type Update = Types.Update;

/**
 * Health check result for Komodo connections.
 * Extends the generic IHealthCheckResult with Komodo-specific details.
 */
export interface HealthCheckResult extends IHealthCheckResult {
  status: 'healthy' | 'unhealthy';
  message: string;
  details: {
    url: string;
    reachable: boolean;
    authenticated: boolean;
    responseTime: number;
    apiVersion?: string;
    error?: string;
  };
}
