/**
 * Transport Core Types
 *
 * Generic type definitions for MCP transport layer.
 * These types are framework-agnostic and can be used with any MCP server.
 *
 * @module server/transport/core/types
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ============================================================================
// Transport Types
// ============================================================================

/**
 * Factory function type for creating MCP server instances.
 * Each transport/session gets its own MCP server instance.
 *
 * @returns A new McpServer instance configured for the session
 *
 * @example
 * ```typescript
 * const factory: McpServerFactory = () => {
 *   const server = new McpServer({ name: 'my-server', version: '1.0.0' });
 *   // Register tools, resources, prompts...
 *   return server;
 * };
 * ```
 */
export type McpServerFactory = () => McpServer;

/**
 * Supported transport types.
 */
export type TransportType = 'http' | 'stdio' | 'sse';

/**
 * Transport state values.
 */
export type TransportState = 'pending' | 'active' | 'closing' | 'closed' | 'error';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Transport configuration options.
 */
export interface TransportConfig {
  /** Transport type to use */
  readonly type: TransportType;

  /** Host to bind to (HTTP only) */
  readonly host?: string;

  /** Port to listen on (HTTP only) */
  readonly port?: number;

  /** Enable legacy SSE transport (HTTP only) */
  readonly legacySseEnabled?: boolean;
}

// ============================================================================
// HTTP Types
// ============================================================================

/**
 * HTTP request with session ID.
 */
export interface SessionRequest {
  /** Session ID from headers or query */
  sessionId?: string;
}

/**
 * HTTP response with session ID setter.
 */
export interface SessionResponse {
  /** Set session ID in response headers */
  setSessionId?: (id: string) => void;
}
