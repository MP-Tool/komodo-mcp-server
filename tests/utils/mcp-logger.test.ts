import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpNotificationLogger, mcpLogger, McpLogLevel } from '../../src/utils/mcp-logger.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Mock McpServer
function createMockMcpServer(): McpServer {
  const mockSendLoggingMessage = vi.fn().mockResolvedValue(undefined);

  return {
    server: {
      sendLoggingMessage: mockSendLoggingMessage,
    },
  } as unknown as McpServer;
}

describe('McpNotificationLogger', () => {
  let mcpNotificationLogger: McpNotificationLogger;
  let mockServer: McpServer;

  beforeEach(() => {
    mcpNotificationLogger = new McpNotificationLogger();
    mockServer = createMockMcpServer();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mcpNotificationLogger.clearServers();
  });

  describe('Server Registration', () => {
    it('should register a server', () => {
      mcpNotificationLogger.addServer(mockServer);
      expect(mcpNotificationLogger.isAvailable()).toBe(true);
    });

    it('should unregister a server', () => {
      mcpNotificationLogger.addServer(mockServer);
      expect(mcpNotificationLogger.isAvailable()).toBe(true);

      mcpNotificationLogger.removeServer(mockServer);
      expect(mcpNotificationLogger.isAvailable()).toBe(false);
    });

    it('should support multiple servers', () => {
      const server2 = createMockMcpServer();
      mcpNotificationLogger.addServer(mockServer);
      mcpNotificationLogger.addServer(server2);
      expect(mcpNotificationLogger.isAvailable()).toBe(true);
    });

    it('should clear all servers', () => {
      mcpNotificationLogger.addServer(mockServer);
      mcpNotificationLogger.addServer(createMockMcpServer());

      mcpNotificationLogger.clearServers();
      expect(mcpNotificationLogger.isAvailable()).toBe(false);
    });
  });

  describe('Enable/Disable', () => {
    it('should be enabled by default', () => {
      mcpNotificationLogger.addServer(mockServer);
      expect(mcpNotificationLogger.isAvailable()).toBe(true);
    });

    it('should not be available when disabled', () => {
      mcpNotificationLogger.addServer(mockServer);
      mcpNotificationLogger.setEnabled(false);
      expect(mcpNotificationLogger.isAvailable()).toBe(false);
    });

    it('should become available when re-enabled', () => {
      mcpNotificationLogger.addServer(mockServer);
      mcpNotificationLogger.setEnabled(false);
      mcpNotificationLogger.setEnabled(true);
      expect(mcpNotificationLogger.isAvailable()).toBe(true);
    });

    it('should not send logs when disabled', async () => {
      mcpNotificationLogger.addServer(mockServer);
      mcpNotificationLogger.setEnabled(false);

      await mcpNotificationLogger.info('test message');

      expect(mockServer.server.sendLoggingMessage).not.toHaveBeenCalled();
    });
  });

  describe('Log Methods', () => {
    beforeEach(() => {
      mcpNotificationLogger.addServer(mockServer);
    });

    it('should send debug log', async () => {
      await mcpNotificationLogger.debug('debug message');

      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledWith({
        level: 'debug',
        data: 'debug message',
      });
    });

    it('should send info log', async () => {
      await mcpNotificationLogger.info('info message');

      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledWith({
        level: 'info',
        data: 'info message',
      });
    });

    it('should send notice log', async () => {
      await mcpNotificationLogger.notice('notice message');

      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledWith({
        level: 'notice',
        data: 'notice message',
      });
    });

    it('should send warning log via warn()', async () => {
      await mcpNotificationLogger.warn('warning message');

      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledWith({
        level: 'warning',
        data: 'warning message',
      });
    });

    it('should send warning log via warning()', async () => {
      await mcpNotificationLogger.warning('warning message');

      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledWith({
        level: 'warning',
        data: 'warning message',
      });
    });

    it('should send error log', async () => {
      await mcpNotificationLogger.error('error message');

      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledWith({
        level: 'error',
        data: 'error message',
      });
    });

    it('should send critical log', async () => {
      await mcpNotificationLogger.critical('critical message');

      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledWith({
        level: 'critical',
        data: 'critical message',
      });
    });

    it('should send alert log', async () => {
      await mcpNotificationLogger.alert('alert message');

      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledWith({
        level: 'alert',
        data: 'alert message',
      });
    });

    it('should send emergency log', async () => {
      await mcpNotificationLogger.emergency('emergency message');

      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledWith({
        level: 'emergency',
        data: 'emergency message',
      });
    });

    it('should format message with data object', async () => {
      await mcpNotificationLogger.info('processing', { count: 42, status: 'ok' });

      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledWith({
        level: 'info',
        data: 'processing {"count":42,"status":"ok"}',
      });
    });
  });

  describe('Internal Log Level Mapping', () => {
    beforeEach(() => {
      mcpNotificationLogger.addServer(mockServer);
    });

    it('should map trace to debug', async () => {
      await mcpNotificationLogger.logInternal('trace', 'trace message');

      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledWith({
        level: 'debug',
        data: 'trace message',
      });
    });

    it('should map debug to debug', async () => {
      await mcpNotificationLogger.logInternal('debug', 'debug message');

      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledWith({
        level: 'debug',
        data: 'debug message',
      });
    });

    it('should map info to info', async () => {
      await mcpNotificationLogger.logInternal('info', 'info message');

      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledWith({
        level: 'info',
        data: 'info message',
      });
    });

    it('should map warn to warning', async () => {
      await mcpNotificationLogger.logInternal('warn', 'warn message');

      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledWith({
        level: 'warning',
        data: 'warn message',
      });
    });

    it('should map error to error', async () => {
      await mcpNotificationLogger.logInternal('error', 'error message');

      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledWith({
        level: 'error',
        data: 'error message',
      });
    });
  });

  describe('Multiple Servers', () => {
    it('should send logs to all registered servers', async () => {
      const server2 = createMockMcpServer();
      const server3 = createMockMcpServer();

      mcpNotificationLogger.addServer(mockServer);
      mcpNotificationLogger.addServer(server2);
      mcpNotificationLogger.addServer(server3);

      await mcpNotificationLogger.info('broadcast message');

      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledTimes(1);
      expect(server2.server.sendLoggingMessage).toHaveBeenCalledTimes(1);
      expect(server3.server.sendLoggingMessage).toHaveBeenCalledTimes(1);
    });

    it('should not fail if one server errors', async () => {
      const errorServer = createMockMcpServer();
      (errorServer.server.sendLoggingMessage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Connection lost'),
      );

      mcpNotificationLogger.addServer(mockServer);
      mcpNotificationLogger.addServer(errorServer);

      // Should not throw
      await expect(mcpNotificationLogger.info('test')).resolves.toBeUndefined();

      // First server should still receive the message
      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('Minimum Log Level', () => {
    beforeEach(() => {
      mcpNotificationLogger.addServer(mockServer);
    });

    it('should respect minimum log level', async () => {
      mcpNotificationLogger.setMinLevel('warning');

      await mcpNotificationLogger.debug('debug');
      await mcpNotificationLogger.info('info');
      await mcpNotificationLogger.warning('warning');
      await mcpNotificationLogger.error('error');

      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledTimes(2);
      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledWith({
        level: 'warning',
        data: 'warning',
      });
      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledWith({
        level: 'error',
        data: 'error',
      });
    });

    it('should filter debug logs when min level is info', async () => {
      mcpNotificationLogger.setMinLevel('info');

      await mcpNotificationLogger.debug('should not appear');
      expect(mockServer.server.sendLoggingMessage).not.toHaveBeenCalled();

      await mcpNotificationLogger.info('should appear');
      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe('Context Logger', () => {
    it('should create a context logger function', () => {
      const contextLogger = mcpNotificationLogger.createContextLogger(mockServer);
      expect(typeof contextLogger).toBe('function');
    });

    it('should send logs via context logger', async () => {
      const contextLogger = mcpNotificationLogger.createContextLogger(mockServer);

      contextLogger('info', 'context message');

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledWith({
        level: 'info',
        data: 'context message',
      });
    });

    it('should map internal levels correctly in context logger', async () => {
      const contextLogger = mcpNotificationLogger.createContextLogger(mockServer);

      contextLogger('warn', 'warning via context');

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledWith({
        level: 'warning',
        data: 'warning via context',
      });
    });

    it('should not throw when context logger fails', async () => {
      const errorServer = createMockMcpServer();
      (errorServer.server.sendLoggingMessage as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Disconnected'),
      );

      const contextLogger = mcpNotificationLogger.createContextLogger(errorServer);

      // Should not throw
      expect(() => contextLogger('error', 'will fail')).not.toThrow();
    });
  });

  describe('No Servers', () => {
    it('should not throw when logging without servers', async () => {
      await expect(mcpNotificationLogger.info('no servers')).resolves.toBeUndefined();
    });

    it('should report not available when no servers', () => {
      expect(mcpNotificationLogger.isAvailable()).toBe(false);
    });
  });

  describe('Singleton Export', () => {
    it('should export a singleton mcpLogger', () => {
      expect(mcpLogger).toBeInstanceOf(McpNotificationLogger);
    });

    it('should be reusable across multiple calls', async () => {
      const server = createMockMcpServer();
      mcpLogger.addServer(server);

      await mcpLogger.info('test 1');
      await mcpLogger.info('test 2');

      expect(server.server.sendLoggingMessage).toHaveBeenCalledTimes(2);

      // Clean up
      mcpLogger.removeServer(server);
    });
  });

  describe('Log Level Order', () => {
    const levels: McpLogLevel[] = ['debug', 'info', 'notice', 'warning', 'error', 'critical', 'alert', 'emergency'];

    beforeEach(() => {
      mcpNotificationLogger.addServer(mockServer);
    });

    it.each(levels)('should allow %s and higher when min level is %s', async (level) => {
      mcpNotificationLogger.setMinLevel(level);

      // The current level should always be logged
      await mcpNotificationLogger.log(level, 'test');
      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledTimes(1);
    });

    it('should filter levels below minimum', async () => {
      mcpNotificationLogger.setMinLevel('error');

      await mcpNotificationLogger.debug('filtered');
      await mcpNotificationLogger.info('filtered');
      await mcpNotificationLogger.notice('filtered');
      await mcpNotificationLogger.warning('filtered');

      expect(mockServer.server.sendLoggingMessage).not.toHaveBeenCalled();

      await mcpNotificationLogger.error('allowed');
      await mcpNotificationLogger.critical('allowed');
      await mcpNotificationLogger.alert('allowed');
      await mcpNotificationLogger.emergency('allowed');

      expect(mockServer.server.sendLoggingMessage).toHaveBeenCalledTimes(4);
    });
  });
});
