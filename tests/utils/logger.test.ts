import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '../../src/utils/logger.js';

// Mock the config module
vi.mock('../../src/config/env.js', () => ({
  config: {
    LOG_LEVEL: 'info',
    LOG_FORMAT: 'text',
    MCP_TRANSPORT: 'stdio'
  }
}));

describe('Logger', () => {
  let logger: Logger;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger = new Logger();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should log info messages to stderr in stdio mode', () => {
    logger.info('test message');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('[INFO ] test message'));
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('should redact sensitive keys in metadata', () => {
    logger.info('user login', { password: 'secret123', username: 'admin' });
    const lastCall = consoleErrorSpy.mock.calls[0][0];
    expect(lastCall).toContain('**********');
    expect(lastCall).toContain('admin');
    expect(lastCall).not.toContain('secret123');
  });

  it('should support printf formatting', () => {
    logger.info('Hello %s', 'World');
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Hello World'));
  });

  it('should scrub JWTs from formatted strings', () => {
    const jwt = 'eyJheader.payload.signature';
    logger.info('Token: %s', jwt);
    const lastCall = consoleErrorSpy.mock.calls[0][0];
    expect(lastCall).toContain('Token: **********');
    expect(lastCall).not.toContain(jwt);
  });

  it('should not log debug messages if level is info', () => {
    logger.debug('debug message');
    expect(consoleErrorSpy).not.toHaveBeenCalled();
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

  it('should prevent log injection by escaping newlines', () => {
    logger.info('Line 1\nLine 2\rLine 3');
    const lastCall = consoleErrorSpy.mock.calls[0][0];
    expect(lastCall).toContain('Line 1\\nLine 2\\rLine 3');
    expect(lastCall).not.toContain('\n');
    expect(lastCall).not.toContain('\r');
  });

  it('should include requestId from context', () => {
    const requestId = 'req-123';
    logger.runWithContext({ requestId }, () => {
      logger.info('test message');
    });
    
    const lastCall = consoleErrorSpy.mock.calls[0][0];
    expect(lastCall).toContain('[Req:req-123]');
    expect(lastCall).toContain('test message');
  });

  it('should include sessionId from context', () => {
    const sessionId = 'sess-123';
    logger.runWithContext({ sessionId }, () => {
      logger.info('test message');
    });
    
    const lastCall = consoleErrorSpy.mock.calls[0][0];
    expect(lastCall).toContain('[sess-123]');
    expect(lastCall).toContain('test message');
  });

  it('should include both sessionId and requestId in combined format', () => {
    const sessionId = 'sess-123';
    const requestId = 'req-123';
    logger.runWithContext({ sessionId, requestId }, () => {
      logger.info('test message');
    });
    
    const lastCall = consoleErrorSpy.mock.calls[0][0];
    expect(lastCall).toContain('[sess-123:req-123]');
    expect(lastCall).toContain('test message');
  });

  it('should call sendMcpLog callback when in context', () => {
    const sendMcpLogSpy = vi.fn();
    const requestId = 'req-456';
    
    logger.runWithContext({ requestId, sendMcpLog: sendMcpLogSpy }, () => {
      logger.info('mcp log message');
    });

    expect(sendMcpLogSpy).toHaveBeenCalledWith('info', 'mcp log message');
  });

});
