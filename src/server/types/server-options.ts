/**
 * Server Configuration Types
 *
 * Types for configuring and building MCP servers.
 * Provides a clean, declarative API for server setup.
 *
 * @module server/types/server-options
 */

import type { IApiClient } from './client.js';
import type { IServerLifecycleHooks, ShutdownConfig } from './lifecycle.js';

// ============================================================================
// Transport Configuration
// ============================================================================

/**
 * Transport modes supported by the MCP framework.
 */
export type TransportMode = 'stdio' | 'http' | 'auto';

/**
 * HTTP transport configuration options.
 */
export interface HttpTransportOptions {
  /** Port to listen on (default: 3000 or MCP_PORT env) */
  port?: number;

  /** Host to bind to (default: '127.0.0.1' or MCP_BIND_HOST env) */
  host?: string;

  /** Enable legacy SSE transport for backwards compatibility */
  legacySseEnabled?: boolean;

  /** Enable CORS (default: based on environment) */
  corsEnabled?: boolean;

  /** Allowed origins for CORS (default: localhost) */
  allowedOrigins?: string[];

  /** Rate limiting: max requests per window */
  rateLimitMax?: number;

  /** Rate limiting: window duration in ms */
  rateLimitWindowMs?: number;
}

/**
 * Transport configuration options.
 */
export interface TransportOptions {
  /** Transport mode to use */
  mode: TransportMode;

  /** HTTP-specific options (only used when mode is 'http') */
  http?: HttpTransportOptions;
}

// ============================================================================
// Server Capabilities
// ============================================================================

/**
 * MCP server capabilities to advertise to clients.
 */
export interface ServerCapabilities {
  /** Enable tools capability with optional list-changed notifications */
  tools?: boolean | { listChanged?: boolean };

  /** Enable resources capability with optional list-changed notifications */
  resources?: boolean | { listChanged?: boolean };

  /** Enable prompts capability with optional list-changed notifications */
  prompts?: boolean | { listChanged?: boolean };

  /** Enable logging capability */
  logging?: boolean;
}

/**
 * Default server capabilities.
 */
export const DEFAULT_CAPABILITIES: ServerCapabilities = {
  tools: { listChanged: true },
  logging: true,
} as const;

// ============================================================================
// Server Options Interface
// ============================================================================

/**
 * Complete server configuration options.
 *
 * This interface provides a declarative way to configure an MCP server.
 * All options have sensible defaults.
 *
 * @typeParam TClient - The API client type (default: IApiClient)
 *
 * @example
 * ```typescript
 * const options: IServerOptions<MyApiClient> = {
 *   name: 'my-mcp-server',
 *   version: '1.0.0',
 *   transport: { mode: 'http', http: { port: 8080 } },
 *   capabilities: { tools: true, resources: true },
 *   lifecycle: {
 *     onStarted: () => console.log('Server started!'),
 *   },
 * };
 * ```
 */
export interface IServerOptions<TClient extends IApiClient = IApiClient> {
  // ─────────────────────────────────────────────────────────────────────────
  // Server Identity
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Server name displayed to MCP clients.
   *
   * @example 'komodo-mcp-server', 'docker-mcp-server'
   */
  name: string;

  /**
   * Server version (typically from package.json).
   *
   * @example '1.0.0'
   */
  version: string;

  // ─────────────────────────────────────────────────────────────────────────
  // Transport Configuration
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Transport configuration.
   *
   * @default { mode: 'auto' } - Auto-detect based on environment
   */
  transport?: TransportOptions;

  // ─────────────────────────────────────────────────────────────────────────
  // Capabilities
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Server capabilities to advertise.
   *
   * @default { tools: { listChanged: true }, logging: true }
   */
  capabilities?: ServerCapabilities;

  // ─────────────────────────────────────────────────────────────────────────
  // Lifecycle
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Lifecycle hooks for startup/shutdown.
   */
  lifecycle?: IServerLifecycleHooks;

  /**
   * Shutdown configuration.
   */
  shutdown?: Partial<ShutdownConfig>;

  // ─────────────────────────────────────────────────────────────────────────
  // API Client (Optional)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Factory function to create the API client.
   * If not provided, server starts without a client (tools that require client will be unavailable).
   *
   * @example
   * ```typescript
   * clientFactory: async () => {
   *   const client = new MyApiClient(config);
   *   await client.connect();
   *   return client;
   * }
   * ```
   */
  clientFactory?: () => Promise<TClient>;

  /**
   * Whether to auto-connect the client on server start.
   *
   * @default true
   */
  autoConnect?: boolean;

  // ─────────────────────────────────────────────────────────────────────────
  // Telemetry (Optional)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Enable OpenTelemetry tracing and metrics.
   *
   * @default false (or OTEL_ENABLED env var)
   */
  telemetryEnabled?: boolean;

  /**
   * OpenTelemetry service name.
   *
   * @default Server name
   */
  telemetryServiceName?: string;
}

// ============================================================================
// Server Builder Result
// ============================================================================

/**
 * Result from server builder/factory.
 */
export interface IServerInstance {
  /** Start the server */
  start(): Promise<void>;

  /** Stop the server gracefully */
  stop(): Promise<void>;

  /**
   * Notify all connected MCP clients that the tool list has changed.
   *
   * Call this when external connection state changes affect tool availability.
   * This is useful when using an external connection manager instead of
   * the builder's internal connection management.
   */
  notifyToolListChanged(): void;

  /** Server name */
  readonly name: string;

  /** Server version */
  readonly version: string;

  /** Whether the server is running */
  readonly isRunning: boolean;
}
