import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  sanitizeForLog, 
  logSecurityStatus, 
  logSessionInitialized, 
  logSessionClosed, 
  logSecurityEvent 
} from '../../../src/transport/utils/logging.js';

describe('Logging Utils', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
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

  describe('logSecurityStatus', () => {
    it('should log localhost binding correctly', () => {
      logSecurityStatus('localhost', 3000);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Bound to localhost only'));
    });

    it('should log 127.0.0.1 binding correctly', () => {
      logSecurityStatus('127.0.0.1', 3000);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Bound to localhost only'));
    });

    it('should log external binding warning', () => {
      logSecurityStatus('0.0.0.0', 3000);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Warning: Bound to %s'), '0.0.0.0');
    });
  });

  describe('logSessionEvents', () => {
    it('should log session initialization', () => {
      logSessionInitialized('123');
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Session initialized'), '123');
    });

    it('should log session closure', () => {
      logSessionClosed('123');
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Session closed'), '123');
    });
  });

  describe('logSecurityEvent', () => {
    it('should log security event without details', () => {
      logSecurityEvent('Attack detected');
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[Security] %s'), 'Attack detected', '');
    });

    it('should log security event with details', () => {
      logSecurityEvent('Attack detected', { ip: '1.2.3.4' });
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[Security] %s'), 'Attack detected', { ip: '1.2.3.4' });
    });
  });
});
