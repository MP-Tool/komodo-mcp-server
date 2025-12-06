import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  sanitizeForLog, 
  logSessionInitialized, 
  logSessionClosed, 
  logSecurityEvent 
} from '../../../src/transport/utils/logging.js';

describe('Logging Utils', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('sanitizeForLog', () => {
    it('should return empty string for null/undefined', () => {
      expect(sanitizeForLog(null)).toBe('');
      expect(sanitizeForLog(undefined)).toBe('');
    });

    it('should sanitize newlines', () => {
      expect(sanitizeForLog('hello\nworld')).toBe('hello world');
      expect(sanitizeForLog('hello\rworld')).toBe('hello world');
    });

    it('should trim whitespace', () => {
      expect(sanitizeForLog('  hello  ')).toBe('hello');
    });
  });

  describe('logSessionEvents', () => {
    it('should log session initialization', () => {
      logSessionInitialized('123');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[INFO ] [transport] Session initialized: 123'));
    });

    it('should log session closure', () => {
      logSessionClosed('123');
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('[INFO ] [transport] Session closed: 123'));
    });
  });

  describe('logSecurityEvent', () => {
    it('should log security event without details', () => {
      logSecurityEvent('Attack detected');
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[WARN ] [transport] Security: Attack detected'));
    });

    it('should log security event with details', () => {
      logSecurityEvent('Attack detected', { ip: '1.2.3.4' });
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[WARN ] [transport] Security: Attack detected {"ip":"1.2.3.4"}'));
    });
  });
});
