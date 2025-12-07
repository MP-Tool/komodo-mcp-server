import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listContainersTool } from '../../src/tools/container/list.js';
import { 
  startContainerTool, 
  stopContainerTool, 
  restartContainerTool, 
  pauseContainerTool, 
  unpauseContainerTool 
} from '../../src/tools/container/manage.js';
import { KomodoClient } from '../../src/api/index.js';

// Mock KomodoClient
const mockClient = {
  containers: {
    list: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    restart: vi.fn(),
    pause: vi.fn(),
    unpause: vi.fn()
  }
} as unknown as KomodoClient;

const mockContext = {
  client: mockClient,
  setClient: vi.fn()
};

describe('Container Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listContainersTool', () => {
    it('should list containers correctly', async () => {
      const mockContainers = [
        { name: 'container1', state: 'running', image: 'nginx:latest' },
        { name: 'container2', state: 'exited', image: 'redis:alpine' }
      ];
      (mockClient.containers.list as any).mockResolvedValue(mockContainers);

      const result = await listContainersTool.handler({ server: 'server1' }, mockContext);

      expect(mockClient.containers.list).toHaveBeenCalledWith('server1');
      expect(result.content[0].text).toContain('container1 (running) - nginx:latest');
      expect(result.content[0].text).toContain('container2 (exited) - redis:alpine');
    });

    it('should handle empty container list', async () => {
      (mockClient.containers.list as any).mockResolvedValue([]);

      const result = await listContainersTool.handler({ server: 'server1' }, mockContext);

      expect(result.content[0].text).toContain('No containers found');
    });

    it('should throw if client is missing', async () => {
      await expect(listContainersTool.handler({ server: 'server1' }, { client: null, setClient: vi.fn() }))
        .rejects.toThrow('Komodo client not initialized');
    });
  });

  describe('startContainerTool', () => {
    it('should start container and return success message', async () => {
      const mockResponse = { status: 'Queued', _id: { $oid: '123' } };
      (mockClient.containers.start as any).mockResolvedValue(mockResponse);

      const result = await startContainerTool.handler({ server: 'server1', container: 'c1' }, mockContext);

      expect(mockClient.containers.start).toHaveBeenCalledWith('server1', 'c1');
      expect(result.content[0].text).toContain('started');
      expect(result.content[0].text).toContain('123');
    });
  });

  describe('stopContainerTool', () => {
    it('should stop container and return success message', async () => {
      const mockResponse = { status: 'Queued', _id: { $oid: '456' } };
      (mockClient.containers.stop as any).mockResolvedValue(mockResponse);

      const result = await stopContainerTool.handler({ server: 'server1', container: 'c1' }, mockContext);

      expect(mockClient.containers.stop).toHaveBeenCalledWith('server1', 'c1');
      expect(result.content[0].text).toContain('stopped');
      expect(result.content[0].text).toContain('456');
    });
  });

  describe('restartContainerTool', () => {
    it('should restart container and return success message', async () => {
      const mockResponse = { status: 'Queued', _id: { $oid: '789' } };
      (mockClient.containers.restart as any).mockResolvedValue(mockResponse);

      const result = await restartContainerTool.handler({ server: 'server1', container: 'c1' }, mockContext);

      expect(mockClient.containers.restart).toHaveBeenCalledWith('server1', 'c1');
      expect(result.content[0].text).toContain('restarted');
      expect(result.content[0].text).toContain('789');
    });
  });

  describe('pauseContainerTool', () => {
    it('should pause container and return success message', async () => {
      const mockResponse = { status: 'Queued', _id: { $oid: 'abc' } };
      (mockClient.containers.pause as any).mockResolvedValue(mockResponse);

      const result = await pauseContainerTool.handler({ server: 'server1', container: 'c1' }, mockContext);

      expect(mockClient.containers.pause).toHaveBeenCalledWith('server1', 'c1');
      expect(result.content[0].text).toContain('paused');
      expect(result.content[0].text).toContain('abc');
    });
  });

  describe('unpauseContainerTool', () => {
    it('should unpause container and return success message', async () => {
      const mockResponse = { status: 'Queued', _id: { $oid: 'def' } };
      (mockClient.containers.unpause as any).mockResolvedValue(mockResponse);

      const result = await unpauseContainerTool.handler({ server: 'server1', container: 'c1' }, mockContext);

      expect(mockClient.containers.unpause).toHaveBeenCalledWith('server1', 'c1');
      expect(result.content[0].text).toContain('resumed');
      expect(result.content[0].text).toContain('def');
    });
  });
});
