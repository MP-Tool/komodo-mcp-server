import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sanitizeForLog,
  logSessionInitialized,
  logSessionClosed,
  logSecurityEvent,
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
    it('should log session initialization with shortened ID', () => {
      logSessionInitialized('12345678-abcd-efgh-ijkl-mnopqrstuvwx');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[INFO ] [transport] Session [12345678] initialized'),
      );
    });

    it('should log session closure with shortened ID', () => {
      logSessionClosed('12345678-abcd-efgh-ijkl-mnopqrstuvwx');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[INFO ] [transport] Session [12345678] closed'),
      );
    });
  });

  describe('logSecurityEvent', () => {
    it('should log security event without details', () => {
      logSecurityEvent('Attack detected');
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[WARN ] [transport] Security: Attack detected'),
      );
    });

    it('should log security event with details', () => {
      logSecurityEvent('Attack detected', { ip: '1.2.3.4' });
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('[WARN ] [transport] Security: Attack detected {"ip":"1.2.3.4"}'),
      );
    });
  });
});
