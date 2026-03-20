/**
 * Komodo MCP specific Connection Manager
 *
 * Provides a typed connection manager instance specifically for KomodoClient.
 * This is the application-specific layer that wraps the generic framework.
 *
 * @module app/connection
 */

import { ConnectionStateManager } from './framework.js';
import type { KomodoClient } from './api/index.js';

/**
 * Komodo-specific connection manager instance.
 *
 * This typed singleton provides full type safety for KomodoClient operations.
 * Use this in the application layer instead of the generic connectionManager.
 *
 * @example
 * ```typescript
 * import { komodoConnectionManager } from '../app/connection.js';
 *
 * // Type-safe access to KomodoClient
 * const client = komodoConnectionManager.getClient();
 * if (client) {
 *   const servers = await client.servers.list();
 * }
 * ```
 */
export const komodoConnectionManager = new ConnectionStateManager<KomodoClient>();

/**
 * Re-export types for convenience
 */
export type { KomodoClient };
