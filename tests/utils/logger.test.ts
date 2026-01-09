import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '../../src/utils/logger.js';
import * as fs from 'fs';
import * as path from 'path';

// Mock the config module
vi.mock('../../src/config/env.js', () => ({
  config: {
    LOG_LEVEL: 'info',
    LOG_FORMAT: 'text',
    MCP_TRANSPORT: 'stdio',
    LOG_DIR: undefined,
  },
}));

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    createWriteStream: vi.fn().mockReturnValue({
      write: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
      emit: vi.fn(),
    }),
  };
});

describe('Logger', () => {
  let logger: Logger;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger = new Logger('test-component');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Text Formatting', () => {
    it('should log info messages to stderr in stdio mode', () => {
      logger.info('test message');
      // Expected format: [TIMESTAMP] [INFO ] [test-component] test message
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/\[INFO \] \[test-component\] test message/));
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should support printf formatting', () => {
      logger.info('Hello %s', 'World');
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringMatching(/Hello World/));
    });

    it('should prevent log injection by escaping newlines', () => {
      logger.info('Line 1\nLine 2\rLine 3');
      const lastCall = consoleErrorSpy.mock.calls[0][0];
      expect(lastCall).toContain('Line 1\\nLine 2\\rLine 3');
    });
  });

  describe('Context & Metadata', () => {
    it('should include requestId from context', () => {
      const requestId = 'req-123';
      logger.runWithContext({ requestId }, () => {
        logger.info('test message');
      });

      const lastCall = consoleErrorSpy.mock.calls[0][0];
      expect(lastCall).toContain('[Req:req-123]');
    });

    it('should include sessionId from context', () => {
      const sessionId = 'sess-456';
      logger.runWithContext({ sessionId }, () => {
        logger.info('test message');
      });

      const lastCall = consoleErrorSpy.mock.calls[0][0];
      // Implementation format: [sessionId] (truncated to 8 chars)
      expect(lastCall).toContain('[sess-456]');
    });

    it('should include both requestId and sessionId', () => {
      logger.runWithContext({ requestId: 'req-1', sessionId: 'sess-1' }, () => {
        logger.info('test message');
      });

      const lastCall = consoleErrorSpy.mock.calls[0][0];
      // Implementation format: [sessionId:requestId] (truncated to 8 chars)
      expect(lastCall).toContain('[sess-1:req-1]');
    });

    it('should truncate long session and request IDs', () => {
      const longId = '1234567890abcdef';
      logger.runWithContext({ requestId: longId, sessionId: longId }, () => {
        logger.info('test message');
      });

      const lastCall = consoleErrorSpy.mock.calls[0][0];
      expect(lastCall).toContain('[12345678:12345678]');
    });
  });

  describe('Secret Scrubbing', () => {
    it('should redact sensitive keys in metadata', () => {
      logger.info('user login', { password: 'secret123', username: 'admin' });
      const lastCall = consoleErrorSpy.mock.calls[0][0];
      expect(lastCall).toContain('**********');
      expect(lastCall).toContain('admin');
      expect(lastCall).not.toContain('secret123');
    });

    it('should scrub JWTs from formatted strings', () => {
      const jwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      logger.info('Token: %s', jwt);
      const lastCall = consoleErrorSpy.mock.calls[0][0];
      expect(lastCall).toContain('Token: **********');
      expect(lastCall).not.toContain(jwt);
    });

    it('should scrub generic secrets in Key-Value format', () => {
      logger.info('Connection string: password=secret123; user=admin');
      const lastCall = consoleErrorSpy.mock.calls[0][0];
      expect(lastCall).toContain('password=**********');
      expect(lastCall).toContain('user=admin');
    });

    it('should scrub Bearer tokens', () => {
      logger.info('Authorization: Bearer my-secret-token');
      const lastCall = consoleErrorSpy.mock.calls[0][0];
      expect(lastCall).toContain('Bearer **********');
    });
  });

  describe('JSON Formatting', () => {
    it('should log in JSON format when configured', async () => {
      // Re-mock config for this test
      vi.resetModules();
      vi.doMock('../../src/config/env.js', () => ({
        config: {
          LOG_LEVEL: 'info',
          LOG_FORMAT: 'json',
          MCP_TRANSPORT: 'stdio',
        },
      }));

      // Re-import Logger to pick up new config
      const { Logger: JsonLogger } = await import('../../src/utils/logger.js');
      const jsonLogger = new JsonLogger('json-test');

      // Spy on console.error again since we reset modules
      const jsonConsoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      jsonLogger.info('json message', { meta: 'data' });

      expect(jsonConsoleErrorSpy).toHaveBeenCalled();
      const lastCall = jsonConsoleErrorSpy.mock.calls[0][0];

      // Parse the JSON output
      const logEntry = JSON.parse(lastCall);

      expect(logEntry).toMatchObject({
        level: 'INFO',
        message: 'json message',
        service: {
          name: 'komodo-mcp-server',
          component: 'json-test',
        },
        meta: 'data',
      });
      expect(logEntry.timestamp).toBeDefined();
    });

    it('should include context in JSON output', async () => {
      // Re-mock config
      vi.resetModules();
      vi.doMock('../../src/config/env.js', () => ({
        config: {
          LOG_LEVEL: 'info',
          LOG_FORMAT: 'json',
          MCP_TRANSPORT: 'stdio',
        },
      }));

      const { Logger: JsonLogger } = await import('../../src/utils/logger.js');
      const jsonLogger = new JsonLogger('json-context');
      const jsonConsoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const requestId = 'req-json';
      const sessionId = 'sess-json';

      jsonLogger.runWithContext({ requestId, sessionId }, () => {
        jsonLogger.info('context message');
      });

      const lastCall = jsonConsoleErrorSpy.mock.calls[0][0];
      const logEntry = JSON.parse(lastCall);

      expect(logEntry.trace.id).toBe(requestId);
      expect(logEntry.session.id).toBe(sessionId);
    });
  });

  describe('File Logging', () => {
    it('should write to file if LOG_DIR is set', async () => {
      // Re-mock config for this test
      vi.resetModules();
      vi.doMock('../../src/config/env.js', () => ({
        config: {
          LOG_LEVEL: 'info',
          LOG_FORMAT: 'text',
          MCP_TRANSPORT: 'stdio',
          LOG_DIR: '/tmp/logs',
        },
      }));

      // Re-import Logger to pick up new config
      const { Logger: LoggerWithFile } = await import('../../src/utils/logger.js');
      const fileLogger = new LoggerWithFile('file-test');

      expect(fs.mkdirSync).toHaveBeenCalledWith('/tmp/logs', { recursive: true });
      expect(fs.createWriteStream).toHaveBeenCalled();

      fileLogger.info('file message');

      // Get the mock write stream
      const writeStreamMock = (fs.createWriteStream as any).mock.results[0].value;
      expect(writeStreamMock.write).toHaveBeenCalledWith(expect.stringContaining('file message'));
    });
  });
});
