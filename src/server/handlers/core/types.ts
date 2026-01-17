/**
 * Handler Core Types Module
 *
 * Defines the fundamental types and interfaces for MCP protocol handlers.
 * These types ensure consistent handler implementation across the codebase.
 *
 * @module server/handlers/core/types
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ============================================================================
// Handler Types
// ============================================================================

/**
 * Type of MCP protocol handler.
 *
 * - `request`: Handles request/response patterns (e.g., ping)
 * - `notification`: Handles one-way notifications (e.g., cancellation)
 */
export type HandlerType = 'request' | 'notification';

/**
 * Handler registration result.
 */
export interface HandlerRegistrationResult {
  /** Whether the handler was successfully registered */
  success: boolean;
  /** Handler name */
  name: string;
  /** Handler type */
  type: HandlerType;
  /** Error message if registration failed */
  error?: string;
}

/**
 * Handler metadata for documentation and debugging.
 */
export interface HandlerMetadata {
  /** Unique handler name */
  name: string;
  /** Handler type (request or notification) */
  type: HandlerType;
  /** Human-readable description */
  description: string;
  /** MCP specification reference URL */
  specUrl?: string;
  /** MCP specification version */
  specVersion?: string;
}

/**
 * Setup function signature for handlers.
 *
 * All handlers follow this pattern:
 * - Take an McpServer instance
 * - Register their handler with the server
 * - Return void (registration is synchronous)
 *
 * @example
 * ```typescript
 * const setupMyHandler: HandlerSetupFn = (server) => {
 *   server.server.setRequestHandler(MySchema, async (request) => {
 *     // Handle request
 *     return { result: 'ok' };
 *   });
 * };
 * ```
 */
export type HandlerSetupFn = (server: McpServer) => void;

/**
 * Handler definition combining setup function with metadata.
 */
export interface HandlerDefinition {
  /** Handler metadata */
  metadata: HandlerMetadata;
  /** Setup function to register the handler */
  setup: HandlerSetupFn;
}

// ============================================================================
// Handler Registry Types
// ============================================================================

/**
 * Handler registry for managing multiple handlers.
 */
export interface HandlerRegistry {
  /** Register a handler definition */
  register(handler: HandlerDefinition): void;
  /** Get all registered handlers */
  getAll(): readonly HandlerDefinition[];
  /** Get handler by name */
  get(name: string): HandlerDefinition | undefined;
  /** Setup all registered handlers on a server */
  setupAll(server: McpServer): HandlerRegistrationResult[];
}

// ============================================================================
// MCP Protocol Handler Result Types
// ============================================================================

/**
 * Result type for ping handler.
 * Per MCP spec, ping returns an empty object.
 */
export type PingResult = Record<string, never>;

/**
 * Cancellation notification params.
 */
export interface CancellationParams {
  /** The ID of the request to cancel */
  requestId: string | number;
  /** Optional reason for cancellation */
  reason?: string;
}
