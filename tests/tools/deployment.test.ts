import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listDeploymentsTool } from '../../src/tools/deployment/list.js';
import { deployContainerTool } from '../../src/tools/deployment/actions.js';
import { KomodoClient } from '../../src/api/komodo-client.js';

// Mock KomodoClient
const mockClient = {
  listDeployments: vi.fn(),
  deployContainer: vi.fn()
} as unknown as KomodoClient;

const mockContext = {
  client: mockClient,
  setClient: vi.fn()
};

describe('Deployment Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listDeploymentsTool', () => {
    it('should list deployments correctly', async () => {
      const mockDeployments = [
        { id: 'dep1', name: 'Deployment 1', state: 'Active' },
        { id: 'dep2', name: 'Deployment 2', state: 'Inactive' }
      ];
      (mockClient.listDeployments as any).mockResolvedValue(mockDeployments);

      const result = await listDeploymentsTool.handler({}, mockContext);

      expect(mockClient.listDeployments).toHaveBeenCalled();
      expect(result.content[0].text).toContain('Deployment 1 (dep1) - State: Active');
      expect(result.content[0].text).toContain('Deployment 2 (dep2) - State: Inactive');
    });

    it('should handle empty deployment list', async () => {
      (mockClient.listDeployments as any).mockResolvedValue([]);

      const result = await listDeploymentsTool.handler({}, mockContext);

      expect(result.content[0].text).toContain('No deployments found');
    });

    it('should throw if client is missing', async () => {
      await expect(listDeploymentsTool.handler({}, { client: null, setClient: vi.fn() }))
        .rejects.toThrow('Komodo client not initialized');
    });
  });

  describe('deployContainerTool', () => {
    it('should deploy container and return success message', async () => {
      const mockResponse = { status: 'Queued', _id: { $oid: '123' } };
      (mockClient.deployContainer as any).mockResolvedValue(mockResponse);

      const result = await deployContainerTool.handler({ deployment: 'dep1' }, mockContext);

      expect(mockClient.deployContainer).toHaveBeenCalledWith('dep1');
      expect(result.content[0].text).toContain('started');
      expect(result.content[0].text).toContain('123');
    });
  });
});
