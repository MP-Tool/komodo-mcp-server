/**
 * Komodo MCP Application Types
 *
 * Application-specific type definitions for the Komodo MCP Server.
 * These types are Komodo-specific and belong in the app layer,
 * not in the generic server framework.
 *
 * @module app/types
 */

import type { IApiClient } from './framework.js';

// ============================================================================
// Client Initializer Types
// ============================================================================

/**
 * Result of client initialization from environment variables.
 *
 * @typeParam TClient - The API client type (must implement IApiClient)
 *
 * @example
 * ```typescript
 * const result: ClientInitResult<KomodoClient> = {
 *   success: true,
 *   client: komodoClient,
 *   authMethod: 'api-key'
 * };
 * ```
 */
export interface ClientInitResult<TClient extends IApiClient = IApiClient> {
  /** Whether initialization was successful */
  readonly success: boolean;
  /** The initialized client if successful */
  readonly client?: TClient;
  /** Error message if initialization failed */
  readonly error?: string;
  /** Authentication method used */
  readonly authMethod?: 'api-key' | 'credentials';
}

/**
 * Environment variable configuration for Komodo client initialization.
 *
 * @example
 * ```typescript
 * const config: ClientEnvConfig = {
 *   url: 'https://komodo.example.com',
 *   apiKey: 'my-api-key',
 *   apiSecret: 'my-api-secret'
 * };
 * ```
 */
export interface ClientEnvConfig {
  /** Komodo API server URL */
  readonly url?: string;
  /** API key for authentication */
  readonly apiKey?: string;
  /** API secret for authentication */
  readonly apiSecret?: string;
  /** Username for credential authentication */
  readonly username?: string;
  /** Password for credential authentication */
  readonly password?: string;
}
