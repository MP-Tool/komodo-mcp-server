/**
 * MCP Notification Logger
 *
 * Provides structured logging via MCP notifications/message protocol.
 * This allows MCP clients to receive and display server-side logs.
 *
 * Per MCP Spec, logging levels follow RFC 5424 (syslog):
 * - emergency: System is unusable
 * - alert: Action must be taken immediately
 * - critical: Critical conditions
 * - error: Error conditions
 * - warning: Warning conditions
 * - notice: Normal but significant condition
 * - info: Informational messages
 * - debug: Debug-level messages
 *
 * @module utils/mcp-logger
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger as baseLogger, LogLevel } from './logger.js';

const localLogger = baseLogger.child({ component: 'mcp-logger' });

/**
 * MCP Logging levels as defined by the MCP specification (RFC 5424).
 */
export type McpLogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

/**
 * Maps internal log levels to MCP logging levels.
 */
const LOG_LEVEL_MAP: Record<LogLevel, McpLogLevel> = {
  trace: 'debug',
  debug: 'debug',
  info: 'info',
  warn: 'warning',
  error: 'error',
};

/**
 * MCP Notification Logger
 *
 * Sends structured log messages to MCP clients via the notifications/message protocol.
 * Clients that support the logging capability will receive and display these messages.
 *
 * @example
 * ```typescript
 * // Set up with MCP server
 * mcpLogger.setServer(mcpServer);
 *
 * // Log messages (sent to all connected clients)
 * mcpLogger.info('Processing request...');
 * mcpLogger.warn('Resource limit approaching', { current: 80, max: 100 });
 * mcpLogger.error('Failed to connect', { error: 'Connection refused' });
 *
 * // Use in async context
 * await mcpLogger.debug('Query completed', { rows: 42 });
 * ```
 */
class McpNotificationLogger {
  private servers: Set<McpServer> = new Set();
  private enabled = true;
  private minLevel: McpLogLevel = 'debug';

  /**
   * Register an MCP server instance for receiving log notifications.
   * Multiple servers can be registered for multi-session scenarios.
   *
   * @param server - The McpServer instance
   */
  addServer(server: McpServer): void {
    this.servers.add(server);
    localLogger.debug('MCP server registered for logging (%d total)', this.servers.size);
  }

  /**
   * Unregister an MCP server instance.
   *
   * @param server - The McpServer instance to remove
   */
  removeServer(server: McpServer): void {
    this.servers.delete(server);
    localLogger.debug('MCP server unregistered from logging (%d remaining)', this.servers.size);
  }

  /**
   * Clear all registered servers.
   */
  clearServers(): void {
    this.servers.clear();
  }

  /**
   * Enable or disable MCP logging.
   * When disabled, log methods become no-ops but still return resolved promises.
   *
   * @param enabled - Whether to enable logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
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
   * Check if logging is currently available.
   */
  isAvailable(): boolean {
    return this.enabled && this.servers.size > 0;
  }

  /**
   * Send a log message to all connected MCP clients.
   *
   * @param level - The MCP log level
   * @param message - The log message
   * @param data - Optional structured data to include
   * @returns Promise that resolves when all sends complete (or immediately if not available)
   */
  async log(level: McpLogLevel, message: string, data?: Record<string, unknown>): Promise<void> {
    if (!this.enabled || this.servers.size === 0) {
      return;
    }

    if (!this.shouldLog(level)) {
      return;
    }

    // Format message with optional data
    const formattedMessage = data ? `${message} ${JSON.stringify(data)}` : message;

    // Send to all registered servers
    const promises = Array.from(this.servers).map(async (server) => {
      try {
        await server.server.sendLoggingMessage({
          level,
          data: formattedMessage,
        });
      } catch {
        // Ignore errors (client may have disconnected)
      }
    });

    await Promise.all(promises);
  }

  /**
   * Send a log message using internal log level (auto-mapped to MCP level).
   *
   * @param level - The internal log level
   * @param message - The log message
   * @param data - Optional structured data
   */
  async logInternal(level: LogLevel, message: string, data?: Record<string, unknown>): Promise<void> {
    const mcpLevel = LOG_LEVEL_MAP[level];
    return this.log(mcpLevel, message, data);
  }

  // Convenience methods for each log level

  /**
   * Log a debug message.
   */
  async debug(message: string, data?: Record<string, unknown>): Promise<void> {
    return this.log('debug', message, data);
  }

  /**
   * Log an info message.
   */
  async info(message: string, data?: Record<string, unknown>): Promise<void> {
    return this.log('info', message, data);
  }

  /**
   * Log a notice message.
   */
  async notice(message: string, data?: Record<string, unknown>): Promise<void> {
    return this.log('notice', message, data);
  }

  /**
   * Log a warning message.
   */
  async warn(message: string, data?: Record<string, unknown>): Promise<void> {
    return this.log('warning', message, data);
  }

  /**
   * Log a warning message (alias for warn).
   */
  async warning(message: string, data?: Record<string, unknown>): Promise<void> {
    return this.log('warning', message, data);
  }

  /**
   * Log an error message.
   */
  async error(message: string, data?: Record<string, unknown>): Promise<void> {
    return this.log('error', message, data);
  }

  /**
   * Log a critical message.
   */
  async critical(message: string, data?: Record<string, unknown>): Promise<void> {
    return this.log('critical', message, data);
  }

  /**
   * Log an alert message.
   */
  async alert(message: string, data?: Record<string, unknown>): Promise<void> {
    return this.log('alert', message, data);
  }

  /**
   * Log an emergency message.
   */
  async emergency(message: string, data?: Record<string, unknown>): Promise<void> {
    return this.log('emergency', message, data);
  }

  /**
   * Create a context-aware logger function for use in tool handlers.
   * Returns a function that can be passed to LogContext.sendMcpLog.
   *
   * @param server - The McpServer instance for this context
   * @returns A function compatible with LogContext.sendMcpLog
   */
  createContextLogger(server: McpServer): (level: LogLevel, message: string) => void {
    return (level: LogLevel, message: string) => {
      const mcpLevel = LOG_LEVEL_MAP[level];
      server.server.sendLoggingMessage({ level: mcpLevel, data: message }).catch(() => {
        // Ignore errors (client may have disconnected)
      });
    };
  }

  /**
   * Check if a log level should be logged based on minimum level.
   */
  private shouldLog(level: McpLogLevel): boolean {
    const levelOrder: McpLogLevel[] = ['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency'];
    const minIndex = levelOrder.indexOf(this.minLevel);
    const currentIndex = levelOrder.indexOf(level);
    return currentIndex >= minIndex;
  }
}

/**
 * Singleton instance of the MCP Notification Logger.
 * Use this for sending log messages to MCP clients.
 */
export const mcpLogger = new McpNotificationLogger();

// Also export the class for testing
export { McpNotificationLogger };
