import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dnsRebindingProtection } from '../../../src/transport/middleware/dns-rebinding.js';
import { config } from '../../../src/config/env.js';
import * as transportConfig from '../../../src/transport/config/transport.config.js';

// Mock dependencies
vi.mock('../../../src/config/env.js', () => ({
  config: {
    MCP_ALLOWED_HOSTS: undefined,
    MCP_BIND_HOST: 'localhost'
  }
}));

vi.mock('../../../src/transport/config/transport.config.js', () => ({
  getAllowedHosts: vi.fn(),
  getAllowedOrigins: vi.fn(),
  isLocalHost: vi.fn()
}));

vi.mock('../../../src/transport/utils/logging.js', () => ({
  logSecurityEvent: vi.fn(),
  sanitizeForLog: (s: string) => s
}));

describe('DNS Rebinding Middleware', () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    req = {
      headers: {
        host: 'localhost:3000'
      }
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    next = vi.fn();
    
    // Reset config
    (config as any).MCP_ALLOWED_HOSTS = undefined;
    (config as any).MCP_BIND_HOST = 'localhost';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should allow valid host in default mode', () => {
    (transportConfig.getAllowedHosts as any).mockReturnValue(['localhost:3000']);
    (transportConfig.isLocalHost as any).mockReturnValue(true);

    dnsRebindingProtection(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should block invalid host', () => {
    (transportConfig.getAllowedHosts as any).mockReturnValue(['localhost:3000']);
    (transportConfig.isLocalHost as any).mockReturnValue(false);
    req.headers.host = 'evil.com';

    dnsRebindingProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ message: expect.stringContaining('Invalid Host') })
    }));
  });

  it('should enforce strict mode when MCP_ALLOWED_HOSTS is set', () => {
    (config as any).MCP_ALLOWED_HOSTS = 'myserver.com';
    (transportConfig.getAllowedHosts as any).mockReturnValue(['myserver.com']);
    // Even if it looks like localhost, strict mode should reject if not in allowed list
    (transportConfig.isLocalHost as any).mockReturnValue(true); 
    
    req.headers.host = 'localhost:3000'; // Not in allowed list

    dnsRebindingProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('should validate Origin when binding to non-localhost', () => {
    (config as any).MCP_BIND_HOST = '0.0.0.0';
    (transportConfig.getAllowedHosts as any).mockReturnValue(['myserver.com']);
    (transportConfig.isLocalHost as any).mockReturnValue(false);
    (transportConfig.getAllowedOrigins as any).mockReturnValue(['https://app.komo.do']);

    req.headers.host = 'myserver.com';
    req.headers.origin = 'https://evil.com';

    dnsRebindingProtection(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: expect.objectContaining({ message: expect.stringContaining('Invalid Origin') })
    }));
  });

  it('should allow valid Origin', () => {
    (config as any).MCP_BIND_HOST = '0.0.0.0';
    (transportConfig.getAllowedHosts as any).mockReturnValue(['myserver.com']);
    (transportConfig.isLocalHost as any).mockReturnValue(false);
    (transportConfig.getAllowedOrigins as any).mockReturnValue(['https://app.komo.do']);

    req.headers.host = 'myserver.com';
    req.headers.origin = 'https://app.komo.do';

    dnsRebindingProtection(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
