/**
 * MCP Log Writer Module
 *
 * Sends log messages to MCP clients via the notifications/message protocol.
 * Clients that support the logging capability will receive and display these messages.
 *
 * @module logger/writers/mcp-writer
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LogLevel, McpLogLevel } from '../core/types.js';
import { LOG_LEVEL_TO_MCP, MCP_LEVEL_ORDER } from '../core/constants.js';
import { BaseLogWriter } from './base-writer.js';

/**
 * MCP Log Writer class for sending logs to MCP clients.
 *
 * Features:
 * - Supports multiple MCP server instances
 * - Maps internal log levels to MCP log levels (RFC 5424)
 * - Fire-and-forget delivery (ignores disconnected clients)
 * - Configurable minimum log level
 *
 * @example
 * ```typescript
 * const writer = new McpLogWriter();
 * writer.addServer(mcpServer);
 * writer.write('info', 'Processing request', 'api');
 * ```
 */
export class McpLogWriter extends BaseLogWriter {
  private servers: Set<McpServer> = new Set();
  private minLevel: McpLogLevel = 'debug';

  /**
   * Register an MCP server instance for receiving log notifications.
   * Multiple servers can be registered for multi-session scenarios.
   *
   * @param server - The McpServer instance
   */
  addServer(server: McpServer): void {
    this.servers.add(server);
  }

  /**
   * Unregister an MCP server instance.
   *
   * @param server - The McpServer instance to remove
   */
  removeServer(server: McpServer): void {
    this.servers.delete(server);
  }

  /**
   * Clear all registered servers.
   */
  clearServers(): void {
    this.servers.clear();
  }

  /**
   * Set the minimum log level.
   * Messages below this level will not be sent.
   *
   * @param level - The minimum log level
   */
  setMinLevel(level: McpLogLevel): void {
    this.minLevel = level;
  }

  /**
   * Write a log message to all connected MCP clients.
   *
   * @param level - The internal log level
   * @param message - The formatted log message
   * @param _component - The component (included in message)
   */
  write(level: LogLevel, message: string, _component: string): void {
    if (!this.enabled || this.servers.size === 0) return;

    const mcpLevel = LOG_LEVEL_TO_MCP[level];
    if (!this.shouldLog(mcpLevel)) return;

    // Send to all registered servers (fire and forget)
    for (const server of this.servers) {
      server.server.sendLoggingMessage({ level: mcpLevel, data: message }).catch(() => {
        // Ignore errors (client may have disconnected)
      });
    }
  }

  /**
   * Check if the writer has any connected servers.
   */
  isAvailable(): boolean {
    return this.enabled && this.servers.size > 0;
  }

  /**
   * Get the number of registered servers.
   */
  getServerCount(): number {
    return this.servers.size;
  }

  /**
   * Check if a log level should be logged based on minimum level.
   */
  private shouldLog(level: McpLogLevel): boolean {
    const minIndex = MCP_LEVEL_ORDER.indexOf(this.minLevel);
    const currentIndex = MCP_LEVEL_ORDER.indexOf(level);
    return currentIndex >= minIndex;
  }

  /**
   * Create a context-aware logger function for use in LogContext.
   * Returns a function compatible with LogContext.sendMcpLog.
   *
   * @param server - The McpServer instance for this context
   * @returns A function compatible with LogContext.sendMcpLog
   */
  createContextLogger(server: McpServer): (level: LogLevel, message: string) => void {
    return (level: LogLevel, message: string) => {
      const mcpLevel = LOG_LEVEL_TO_MCP[level];
      server.server.sendLoggingMessage({ level: mcpLevel, data: message }).catch(() => {
        // Ignore errors
      });
    };
  }
}

/**
 * Singleton instance of the MCP Log Writer.
 */
export const mcpLogWriter = new McpLogWriter();
