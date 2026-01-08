/**
 * MCP Server Configuration
 *
 * Core configuration for the MCP server instance.
 * Defines server identity, version, and capability settings.
 *
 * @module config/server
 */

import { config } from './env.js';

/**
 * Server name as advertised to MCP clients
 */
export const SERVER_NAME = 'komodo-mcp-server';

/**
 * Server version (from package.json via environment)
 */
export const SERVER_VERSION = config.VERSION;
