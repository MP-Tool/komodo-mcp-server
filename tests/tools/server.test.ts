import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listServersTool } from '../../src/tools/server/list.js';
import { getServerStatsTool } from '../../src/tools/server/stats.js';
import { KomodoClient } from '../../src/api/komodo-client.js';

// Mock KomodoClient
const mockClient = {
  listServers: vi.fn(),
  getServerState: vi.fn()
} as unknown as KomodoClient;

const mockContext = {
  client: mockClient,
  setClient: vi.fn()
};

describe('Server Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listServersTool', () => {
    it('should list servers correctly', async () => {
      const mockServers = [
        { 
          id: 'server1', 
          name: 'Main Server', 
          info: { state: 'Ok', version: '1.0.0', region: 'us-east' } 
        },
        { 
          id: 'server2', 
          name: 'Backup Server', 
          info: { state: 'NotOk', version: 'unknown' } 
        }
      ];
      (mockClient.listServers as any).mockResolvedValue(mockServers);

      const result = await listServersTool.handler({}, mockContext);

      expect(mockClient.listServers).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Main Server (server1) - Status: Ok | Version: 1.0.0 | Region: us-east');
      expect(result.content[0].text).toContain('Backup Server (server2) - Status: NotOk | Version: N/A');
    });

    it('should handle empty server list', async () => {
      (mockClient.listServers as any).mockResolvedValue([]);

      const result = await listServersTool.handler({}, mockContext);

      expect(result.content[0].text).toContain('No servers found');
    });

    it('should throw if client is missing', async () => {
      await expect(listServersTool.handler({}, { client: null, setClient: vi.fn() }))
        .rejects.toThrow('Komodo client not initialized');
    });
  });

  describe('getServerStatsTool', () => {
    it('should get server stats correctly', async () => {
      const mockStats = { status: 'Ok' };
      (mockClient.getServerState as any).mockResolvedValue(mockStats);

      const result = await getServerStatsTool.handler({ server: 'server1' }, mockContext);

      expect(mockClient.getServerState).toHaveBeenCalledWith('server1');
      expect(result.content[0].text).toContain('Status: Ok');
    });

    it('should throw if client is missing', async () => {
      await expect(getServerStatsTool.handler({ server: 'server1' }, { client: null, setClient: vi.fn() }))
        .rejects.toThrow('Komodo client not initialized');
    });
  });
});
