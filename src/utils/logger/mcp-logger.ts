/**
 * MCP Notification Logger Module
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
 * @module utils/logger/mcp-logger
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LogLevel, McpLogLevel } from './core/types.js';
import { LOG_LEVEL_TO_MCP, MCP_LEVEL_ORDER } from './core/constants.js';
import { secretScrubber as sharedScrubber } from './scrubbing/secret-scrubber.js';
import { logger as baseLogger } from './logger.js';

// Create a child logger for this module
const localLogger = baseLogger.child({ component: 'mcp-logger' });

// ============================================================
// Constants
// ============================================================

// Use centralized constants from core/constants.ts
const LOG_LEVEL_MAP = LOG_LEVEL_TO_MCP;

// ============================================================
// Types
// ============================================================

/**
 * Configuration options for MCP Notification Logger.
 */
export interface McpLoggerConfig {
  /** Minimum log level to send (default: 'debug') */
  minLevel?: McpLogLevel;
  /** Whether logging is enabled (default: true) */
  enabled?: boolean;
}

// ============================================================
// McpNotificationLogger Class
// ============================================================

/**
 * MCP Notification Logger
 *
 * Sends structured log messages to MCP clients via the notifications/message protocol.
 * Clients that support the logging capability will receive and display these messages.
 *
 * Features:
 * - Multi-server support for multi-session scenarios
 * - Level filtering with configurable minimum level
 * - Secret scrubbing for security
 * - Context-aware logger creation for tool handlers
 *
 * @example
 * ```typescript
 * // Set up with MCP server
 * mcpLogger.addServer(mcpServer);
 *
 * // Log messages (sent to all connected clients)
 * await mcpLogger.info('Processing request...');
 * await mcpLogger.warn('Resource limit approaching', { current: 80, max: 100 });
 * await mcpLogger.error('Failed to connect', { error: 'Connection refused' });
 * ```
 */
export class McpNotificationLogger {
  // ============================================================
  // Instance Properties
  // ============================================================

  /** Set of registered MCP server instances */
  private readonly servers: Set<McpServer> = new Set();

  /** Whether logging is enabled */
  private enabled: boolean;

  /** Minimum log level to send */
  private minLevel: McpLogLevel;

  /** Use shared secret scrubber instance for consistency */
  private readonly secretScrubber = sharedScrubber;

  // ============================================================
  // Constructor
  // ============================================================

  /**
   * Create a new McpNotificationLogger.
   *
   * @param config - Optional configuration
   */
  constructor(config: McpLoggerConfig = {}) {
    this.enabled = config.enabled ?? true;
    this.minLevel = config.minLevel ?? 'debug';
  }

  // ============================================================
  // Server Management
  // ============================================================

  /**
   * Register an MCP server instance for receiving log notifications.
   * Multiple servers can be registered for multi-session scenarios.
   *
   * @param server - The McpServer instance
   */
  public addServer(server: McpServer): void {
    this.servers.add(server);
    localLogger.debug('MCP server registered for logging', { totalServers: this.servers.size });
  }

  /**
   * Unregister an MCP server instance.
   *
   * @param server - The McpServer instance to remove
   */
  public removeServer(server: McpServer): void {
    this.servers.delete(server);
    localLogger.debug('MCP server unregistered from logging', { remainingServers: this.servers.size });
  }

  /**
   * Clear all registered servers.
   */
  public clearServers(): void {
    this.servers.clear();
    localLogger.debug('All MCP servers cleared from logging');
  }

  /**
   * Get the number of registered servers.
   */
  public getServerCount(): number {
    return this.servers.size;
  }

  // ============================================================
  // Configuration
  // ============================================================

  /**
   * Enable or disable MCP logging.
   * When disabled, log methods become no-ops but still return resolved promises.
   *
   * @param enabled - Whether to enable logging
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if logging is enabled.
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Set the minimum log level.
   * Messages below this level will not be sent.
   *
   * @param level - The minimum log level
   */
  public setMinLevel(level: McpLogLevel): void {
    this.minLevel = level;
  }

  /**
   * Get the current minimum log level.
   */
  public getMinLevel(): McpLogLevel {
    return this.minLevel;
  }

  /**
   * Check if logging is currently available (enabled and has servers).
   */
  public isAvailable(): boolean {
    return this.enabled && this.servers.size > 0;
  }

  // ============================================================
  // Core Logging Methods
  // ============================================================

  /**
   * Send a log message to all connected MCP clients.
   *
   * @param level - The MCP log level
   * @param message - The log message
   * @param data - Optional structured data to include
   * @returns Promise that resolves when all sends complete
   */
  public async log(level: McpLogLevel, message: string, data?: Record<string, unknown>): Promise<void> {
    // Early return if not available or below minimum level
    if (!this.enabled || this.servers.size === 0 || !this.shouldLog(level)) {
      return;
    }

    // Format message with optional data and scrub secrets
    const formattedMessage = this.formatMessage(message, data);
    const safeMessage = this.secretScrubber.scrub(formattedMessage);

    // Send to all registered servers in parallel
    const sendPromises = Array.from(this.servers).map((server) => this.sendToServer(server, level, safeMessage));

    await Promise.all(sendPromises);
  }

  /**
   * Send a log message using internal log level (auto-mapped to MCP level).
   *
   * @param level - The internal log level
   * @param message - The log message
   * @param data - Optional structured data
   */
  public async logInternal(level: LogLevel, message: string, data?: Record<string, unknown>): Promise<void> {
    const mcpLevel = LOG_LEVEL_MAP[level];
    return this.log(mcpLevel, message, data);
  }

  // ============================================================
  // Convenience Methods (RFC 5424 Levels)
  // ============================================================

  /** Log a debug message */
  public async debug(message: string, data?: Record<string, unknown>): Promise<void> {
    return this.log('debug', message, data);
  }

  /** Log an info message */
  public async info(message: string, data?: Record<string, unknown>): Promise<void> {
    return this.log('info', message, data);
  }

  /** Log a notice message */
  public async notice(message: string, data?: Record<string, unknown>): Promise<void> {
    return this.log('notice', message, data);
  }

  /** Log a warning message */
  public async warn(message: string, data?: Record<string, unknown>): Promise<void> {
    return this.log('warning', message, data);
  }

  /** Log a warning message (alias for warn) */
  public async warning(message: string, data?: Record<string, unknown>): Promise<void> {
    return this.log('warning', message, data);
  }

  /** Log an error message */
  public async error(message: string, data?: Record<string, unknown>): Promise<void> {
    return this.log('error', message, data);
  }

  /** Log a critical message */
  public async critical(message: string, data?: Record<string, unknown>): Promise<void> {
    return this.log('critical', message, data);
  }

  /** Log an alert message */
  public async alert(message: string, data?: Record<string, unknown>): Promise<void> {
    return this.log('alert', message, data);
  }

  /** Log an emergency message */
  public async emergency(message: string, data?: Record<string, unknown>): Promise<void> {
    return this.log('emergency', message, data);
  }

  // ============================================================
  // Context Logger Factory
  // ============================================================

  /**
   * Create a context-aware logger function for use in tool handlers.
   * Returns a function that can be passed to LogContext.sendMcpLog.
   *
   * @param server - The McpServer instance for this context
   * @returns A function compatible with LogContext.sendMcpLog
   *
   * @example
   * ```typescript
   * const sendMcpLog = mcpLogger.createContextLogger(server);
   * logger.runWithContext({ sendMcpLog }, () => {
   *   logger.info('This will also be sent to MCP client');
   * });
   * ```
   */
  public createContextLogger(server: McpServer): (level: LogLevel, message: string) => void {
    return (level: LogLevel, message: string): void => {
      const mcpLevel = LOG_LEVEL_MAP[level];
      const safeMessage = this.secretScrubber.scrub(message);

      server.server.sendLoggingMessage({ level: mcpLevel, data: safeMessage }).catch(() => {
        // Silently ignore errors (client may have disconnected)
      });
    };
  }

  // ============================================================
  // Private Helper Methods
  // ============================================================

  /**
   * Check if a log level should be logged based on minimum level.
   */
  private shouldLog(level: McpLogLevel): boolean {
    const minIndex = MCP_LEVEL_ORDER.indexOf(this.minLevel);
    const currentIndex = MCP_LEVEL_ORDER.indexOf(level);
    return currentIndex >= minIndex;
  }

  /**
   * Format message with optional data.
   */
  private formatMessage(message: string, data?: Record<string, unknown>): string {
    if (!data || Object.keys(data).length === 0) {
      return message;
    }
    return `${message} ${JSON.stringify(data)}`;
  }

  /**
   * Send a log message to a specific server.
   */
  private async sendToServer(server: McpServer, level: McpLogLevel, message: string): Promise<void> {
    try {
      await server.server.sendLoggingMessage({
        level,
        data: message,
      });
    } catch {
      // Silently ignore errors (client may have disconnected)
    }
  }
}

// ============================================================
// Singleton Export
// ============================================================

/**
 * Singleton instance of the MCP Notification Logger.
 * Use this for sending log messages to MCP clients.
 */
export const mcpLogger = new McpNotificationLogger();
