/**
 * Komodo MCP Application Layer
 *
 * This module contains Komodo-specific application code that builds on the generic
 * MCP framework in `server/`. It provides:
 *
 * - Typed KomodoClient connection management
 * - Auto-configuration from environment variables
 * - Komodo-specific bootstrap logic
 * - Komodo-specific telemetry attributes
 * - Application-specific errors (API, Auth, Resource)
 * - Server options and lifecycle hooks
 * - Registry adapters for the builder pattern
 *
 * The separation allows the `server/` module to be extracted as a reusable
 * MCP framework package in the future, while keeping app-specific code here.
 *
 * @module app
 */

// ─────────────────────────────────────────────────────────────────────────
// Server Configuration & Options
// ─────────────────────────────────────────────────────────────────────────

export {
  komodoServerOptions,
  createKomodoServerOptions,
  createKomodoLifecycleHooks,
  createKomodoClientFromEnv,
} from './server-options.js';

// ─────────────────────────────────────────────────────────────────────────
// Registry Adapters (for McpServerBuilder)
// ─────────────────────────────────────────────────────────────────────────

export { toolRegistryAdapter, resourceRegistryAdapter, promptRegistryAdapter } from './adapters.js';

// ─────────────────────────────────────────────────────────────────────────
// Connection Management
// ─────────────────────────────────────────────────────────────────────────

// Komodo-specific connection manager
export { komodoConnectionManager } from './connection.js';
export type { KomodoClient } from './connection.js';

// Komodo client auto-initialization
export { initializeKomodoClientFromEnv } from './client-initializer.js';

// Application-specific types
export type { ClientInitResult, ClientEnvConfig } from './types.js';

// Komodo-specific telemetry attributes
export { KOMODO_ATTRIBUTES } from './telemetry.js';
export type { KomodoAttributeKey, KomodoAttributeValue } from './telemetry.js';

// ─────────────────────────────────────────────────────────────────────────
// Application Errors
// ─────────────────────────────────────────────────────────────────────────

export {
  // Factory (recommended for error creation)
  AppErrorFactory,
  // Classes
  ApiError,
  ConnectionError,
  AuthenticationError,
  NotFoundError,
  ClientNotConfiguredError,
  // Messages
  AppMessages,
  getAppMessage,
  // Types
  type AppMessageKey,
  type AppErrorFactoryType,
} from './errors/index.js';
