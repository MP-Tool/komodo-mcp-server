import { describe, it, expect, vi, beforeEach } from 'vitest';
import { configureTool } from '../../src/tools/config/configure.js';
import { healthCheckTool } from '../../src/tools/config/health.js';
import { KomodoClient } from '../../src/api/komodo-client.js';

// Mock KomodoClient class and instance
const mockClientInstance = {
  healthCheck: vi.fn()
};

// Mock the static login method
vi.mock('../../src/api/komodo-client.js', () => {
  return {
    KomodoClient: {
      login: vi.fn()
    }
  };
});

const mockContext = {
  client: mockClientInstance as unknown as KomodoClient,
  setClient: vi.fn()
};

describe('Config Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('configureTool', () => {
    it('should login and return success message if healthy', async () => {
      const mockHealth = {
        status: 'healthy',
        details: { responseTime: 10, apiVersion: '1.0.0' }
      };
      (mockClientInstance.healthCheck as any).mockResolvedValue(mockHealth);
      (KomodoClient.login as any).mockResolvedValue(mockClientInstance);

      const args = { url: 'http://localhost', username: 'user', password: 'pass' };
      const result = await configureTool.handler(args, mockContext);

      expect(KomodoClient.login).toHaveBeenCalledWith(args.url, args.username, args.password);
      expect(mockContext.setClient).toHaveBeenCalledWith(mockClientInstance);
      expect(result.content[0].text).toContain('successfully configured');
      expect(result.content[0].text).toContain('Authentication: OK');
    });

    it('should login and return warning if unhealthy', async () => {
      const mockHealth = {
        status: 'unhealthy',
        message: 'Something wrong',
        details: { error: 'Connection refused' }
      };
      (mockClientInstance.healthCheck as any).mockResolvedValue(mockHealth);
      (KomodoClient.login as any).mockResolvedValue(mockClientInstance);

      const args = { url: 'http://localhost', username: 'user', password: 'pass' };
      const result = await configureTool.handler(args, mockContext);

      expect(KomodoClient.login).toHaveBeenCalled();
      expect(mockContext.setClient).toHaveBeenCalled();
      expect(result.content[0].text).toContain('health check failed');
      expect(result.content[0].text).toContain('Something wrong');
    });
  });

  describe('healthCheckTool', () => {
    it('should return not configured message if client is missing', async () => {
      const result = await healthCheckTool.handler({}, { client: null, setClient: vi.fn() });

      expect(result.content[0].text).toContain('Komodo Client not configured');
    });

    it('should return healthy message if check passes', async () => {
      const mockHealth = {
        status: 'healthy',
        message: 'All good',
        details: { url: 'http://localhost', responseTime: 20, authenticated: true }
      };
      (mockClientInstance.healthCheck as any).mockResolvedValue(mockHealth);

      const result = await healthCheckTool.handler({}, mockContext);

      expect(mockClientInstance.healthCheck).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Komodo server is reachable');
      expect(result.content[0].text).toContain('All good');
    });

    it('should return unhealthy message if check fails', async () => {
      const mockHealth = {
        status: 'unhealthy',
        message: 'Bad connection',
        details: { url: 'http://localhost', responseTime: 0, reachable: false, authenticated: false }
      };
      (mockClientInstance.healthCheck as any).mockResolvedValue(mockHealth);

      const result = await healthCheckTool.handler({}, mockContext);

      expect(result.content[0].text).toContain('Komodo server health check failed');
      expect(result.content[0].text).toContain('Bad connection');
    });
  });
});
