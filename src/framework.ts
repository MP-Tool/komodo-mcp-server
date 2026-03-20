/**
 * Framework Re-exports
 *
 * Central barrel file that re-exports all MCP Framework features.
 * This provides a single import point for framework functionality,
 * making future npm package migration straightforward.
 *
 * When the framework is extracted to `@mp-tool/mcp-server-framework`,
 * only this file needs to change:
 *
 * ```typescript
 * // Before (local)
 * export * from '../server/index.js';
 *
 * // After (npm package)
 * export * from '@mp-tool/mcp-server-framework';
 * ```
 *
 * @module app/framework
 */

// Re-export everything from the framework
export * from '../server/index.js';
