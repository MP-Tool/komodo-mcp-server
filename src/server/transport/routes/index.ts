/**
 * Transport Routes Module
 *
 * Exports route handlers for HTTP transport.
 *
 * @module transport/routes
 */

export { createHealthRouter } from './health.js';
export {
  createMcpRouter,
  createLegacySseRouter,
  closeAllLegacySseSessions,
  isLegacySseEnabled,
  getLegacySseSessionCount,
} from './mcp.js';
