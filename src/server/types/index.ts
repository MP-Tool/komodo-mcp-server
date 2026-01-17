/**
 * Server Core Types
 *
 * Framework-agnostic type definitions for the MCP server.
 * These types form the foundation for building MCP servers with any API backend.
 *
 * @module server/types
 *
 * @example
 * ```typescript
 * import {
 *   IApiClient,
 *   IServerOptions,
 *   IToolContext,
 *   IRegistry,
 * } from '@my-org/mcp-framework/server/types';
 *
 * // Define your API client
 * class MyApiClient implements IApiClient {
 *   readonly clientType = 'my-api';
 *   async healthCheck() { return { status: 'healthy' }; }
 * }
 *
 * // Configure your server
 * const options: IServerOptions<MyApiClient> = {
 *   name: 'my-server',
 *   version: '1.0.0',
 *   transport: { mode: 'http' },
 * };
 * ```
 */

// ============================================================================
// API Client Types
// ============================================================================

export type { HealthStatus, IHealthCheckResult, IApiClient, ApiClientFactory } from './client.js';

export { isApiClient } from './client.js';

// ============================================================================
// Tool Context Types
// ============================================================================

export type { ProgressData, ProgressReporter, IToolContext, ToolHandler } from './tool-context.js';

// ============================================================================
// Server Lifecycle Types
// ============================================================================

export type {
  ServerState,
  ServerLifecycleEventType,
  ServerLifecycleEvent,
  ServerLifecycleListener,
  IServerLifecycleHooks,
  ShutdownConfig,
  ILifecycleManager,
} from './lifecycle.js';

export { SERVER_STATES, DEFAULT_SHUTDOWN_CONFIG } from './lifecycle.js';

// ============================================================================
// Registry Types
// ============================================================================

export type {
  // Base
  IRegistryItem,
  IRegistry,
  // Tools
  ITool,
  IToolRegistry,
  // Resources
  IResource,
  IResourceTemplate,
  IResourceRegistry,
  // Prompts
  IPromptArgument,
  IPromptMessage,
  IPrompt,
  IPromptRegistry,
} from './registry.js';

// ============================================================================
// Server Options Types
// ============================================================================

export type {
  // Transport
  TransportMode,
  HttpTransportOptions,
  TransportOptions,
  // Capabilities
  ServerCapabilities,
  // Server Options
  IServerOptions,
  IServerInstance,
} from './server-options.js';

export { DEFAULT_CAPABILITIES } from './server-options.js';
