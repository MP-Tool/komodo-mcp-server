import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TransportSessionManager } from '../../src/transport/session-manager.js';

// Mock Config
vi.mock('../../src/transport/config/transport.config.js', () => ({
  SESSION_TIMEOUT_MS: 1000,
  SESSION_CLEANUP_INTERVAL_MS: 100,
  SESSION_KEEP_ALIVE_INTERVAL_MS: 50,
  SESSION_MAX_MISSED_HEARTBEATS: 3
}));

describe('Session Manager', () => {
  let manager: TransportSessionManager;
  let mockTransport: any;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new TransportSessionManager();
    mockTransport = {
      close: vi.fn().mockResolvedValue(undefined),
      sendHeartbeat: vi.fn().mockReturnValue(true)
    };
  });

  afterEach(async () => {
    await manager.closeAll();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should add and get session', () => {
    manager.add('session-1', mockTransport);
    expect(manager.get('session-1')).toBe(mockTransport);
    expect(manager.has('session-1')).toBe(true);
    expect(manager.size).toBe(1);
  });

  it('should remove session', () => {
    manager.add('session-1', mockTransport);
    expect(manager.remove('session-1')).toBe(true);
    expect(manager.has('session-1')).toBe(false);
    expect(manager.size).toBe(0);
  });

  it('should update last activity on touch', () => {
    manager.add('session-1', mockTransport);
    const initialActivity = (manager as any).sessions.get('session-1').lastActivity;
    
    vi.advanceTimersByTime(500);
    manager.touch('session-1');
    
    const updatedActivity = (manager as any).sessions.get('session-1').lastActivity;
    expect(updatedActivity.getTime()).toBeGreaterThan(initialActivity.getTime());
  });

  it('should expire idle sessions', async () => {
    manager.add('session-1', mockTransport);
    
    // Mock heartbeat to fail so it expires
    mockTransport.sendHeartbeat.mockReturnValue(false);

    // Advance time past timeout
    vi.advanceTimersByTime(1100);
    
    // Trigger cleanup (interval runs every 100ms)
    vi.advanceTimersByTime(100);

    expect(mockTransport.close).toHaveBeenCalled();
    expect(manager.has('session-1')).toBe(false);
  });

  it('should keep session alive if heartbeat succeeds during cleanup', () => {
    manager.add('session-1', mockTransport);
    mockTransport.sendHeartbeat.mockReturnValue(true);

    // Advance time past timeout
    vi.advanceTimersByTime(1100);
    
    // Trigger cleanup
    vi.advanceTimersByTime(100);

    // Should NOT close because heartbeat succeeded
    expect(mockTransport.close).not.toHaveBeenCalled();
    expect(manager.has('session-1')).toBe(true);
    
    // Activity should be updated
    const activity = (manager as any).sessions.get('session-1').lastActivity;
    expect(Date.now() - activity.getTime()).toBeLessThanOrEqual(100);
  });

  it('should send keep-alive heartbeats', () => {
    manager.add('session-1', mockTransport);
    
    vi.advanceTimersByTime(50); // Interval is 50ms
    
    expect(mockTransport.sendHeartbeat).toHaveBeenCalled();
  });

  it('should close session after max missed heartbeats', () => {
    manager.add('session-1', mockTransport);
    mockTransport.sendHeartbeat.mockReturnValue(false);

    // 3 missed heartbeats required
    // Interval 50ms.
    // 1st: 50ms
    // 2nd: 100ms
    // 3rd: 150ms -> Close
    
    vi.advanceTimersByTime(200);

    expect(mockTransport.close).toHaveBeenCalled();
    expect(manager.has('session-1')).toBe(false);
  });

  it('should close all sessions', async () => {
    manager.add('session-1', mockTransport);
    manager.add('session-2', { ...mockTransport });

    await manager.closeAll();

    expect(mockTransport.close).toHaveBeenCalled();
    expect(manager.size).toBe(0);
  });
});
