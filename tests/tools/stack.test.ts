import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listStacksTool } from '../../src/tools/stack/list.js';
import { stopStackTool, deployStackTool } from '../../src/tools/stack/actions.js';
import { KomodoClient } from '../../src/api/index.js';

// Mock KomodoClient
const mockClient = {
  stacks: {
    list: vi.fn(),
    stop: vi.fn(),
    deploy: vi.fn(),
  },
} as unknown as KomodoClient;

const mockContext = {
  client: mockClient,
  setClient: vi.fn(),
};

describe('Stack Tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listStacksTool', () => {
    it('should list stacks correctly', async () => {
      const mockStacks = [
        { id: 'stack1', name: 'My Stack', info: { state: 'Running' } },
        { id: 'stack2', name: 'Other Stack', info: { state: 'Stopped' } },
      ];
      (mockClient.stacks.list as any).mockResolvedValue(mockStacks);

      const result = await listStacksTool.handler({}, mockContext);

      expect(mockClient.stacks.list).toHaveBeenCalled();
      expect(result.content[0].text).toContain('My Stack (stack1) - State: Running');
      expect(result.content[0].text).toContain('Other Stack (stack2) - State: Stopped');
    });

    it('should handle empty stack list', async () => {
      (mockClient.stacks.list as any).mockResolvedValue([]);

      const result = await listStacksTool.handler({}, mockContext);

      expect(result.content[0].text).toContain('No stacks found');
    });

    it('should throw if client is missing', async () => {
      await expect(listStacksTool.handler({}, { client: null, setClient: vi.fn() })).rejects.toThrow(
        'Komodo client not initialized',
      );
    });
  });

  describe('stopStackTool', () => {
    it('should stop stack and return success message', async () => {
      const mockResponse = { status: 'Queued', _id: { $oid: '123' } };
      (mockClient.stacks.stop as any).mockResolvedValue(mockResponse);

      const result = await stopStackTool.handler({ stack: 'stack1' }, mockContext);

      expect(mockClient.stacks.stop).toHaveBeenCalledWith('stack1');
      expect(result.content[0].text).toContain('stopped');
      expect(result.content[0].text).toContain('123');
    });
  });

  describe('deployStackTool', () => {
    it('should deploy stack and return success message', async () => {
      const mockResponse = { status: 'Queued', _id: { $oid: '456' } };
      (mockClient.stacks.deploy as any).mockResolvedValue(mockResponse);

      const result = await deployStackTool.handler({ stack: 'stack1' }, mockContext);

      expect(mockClient.stacks.deploy).toHaveBeenCalledWith('stack1');
      expect(result.content[0].text).toContain('deployed');
      expect(result.content[0].text).toContain('456');
    });
  });
});
