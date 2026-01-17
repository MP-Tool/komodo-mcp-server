/**
 * SSE Transport Types
 *
 * Type definitions for SSE Transport (MCP 2024-11-05 - deprecated but supported)
 *
 * @module server/transport/sse/types
 */

// Re-export from core for convenience
export type { McpServerFactory } from '../core/types.js';

/**
 * Response object that may have a flush method added by middleware.
 * Some Express middleware (like compression) add this method.
 */
export interface FlushableResponse extends Response {
  flush?: () => void;
}
