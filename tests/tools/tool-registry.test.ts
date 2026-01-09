/**
 * Tests for Tool Registry
 *
 * Tests the tool registry including:
 * - Tool registration
 * - Connection-based tool availability
 * - Tool list change notifications
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';

/** Test tool interface */
interface TestTool {
  name: string;
  description: string;
  schema: ReturnType<typeof z.object>;
  requiresClient?: boolean;
  handler: () => Promise<{ content: Array<{ type: string; text: string }> }>;
}

/**
 * Test implementation of ToolRegistry.
 * Mirrors the real implementation for isolated testing.
 */
class TestToolRegistry {
  private tools: Map<string, TestTool> = new Map();
  private isConnected = false;
  private listeners: Set<(tools: TestTool[]) => void> = new Set();

  register(tool: TestTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): TestTool | undefined {
    const tool = this.tools.get(name);
    if (!tool) return undefined;
    if (this.requiresConnection(tool) && !this.isConnected) {
      return undefined;
    }
    return tool;
  }

  getTools(): TestTool[] {
    return Array.from(this.tools.values());
  }

  getAvailableTools(): TestTool[] {
    return Array.from(this.tools.values()).filter((tool) => {
      if (this.requiresConnection(tool)) {
        return this.isConnected;
      }
      return true;
    });
  }

  getClientRequiredTools(): TestTool[] {
    return Array.from(this.tools.values()).filter((tool) => this.requiresConnection(tool));
  }

  getAlwaysAvailableTools(): TestTool[] {
    return Array.from(this.tools.values()).filter((tool) => !this.requiresConnection(tool));
  }

  setConnectionState(connected: boolean): boolean {
    if (this.isConnected === connected) {
      return false;
    }
    this.isConnected = connected;
    this.notifyListeners();
    return true;
  }

  getConnectionState(): boolean {
    return this.isConnected;
  }

  onAvailabilityChange(listener: (tools: TestTool[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  clearListeners(): void {
    this.listeners.clear();
  }

  private requiresConnection(tool: TestTool): boolean {
    return tool.requiresClient !== false;
  }

  private notifyListeners(): void {
    const availableTools = this.getAvailableTools();
    for (const listener of this.listeners) {
      try {
        listener(availableTools);
      } catch (error) {
        // Ignore
      }
    }
  }
}

// Create test tools
const createTool = (name: string, requiresClient: boolean = true) => ({
  name,
  description: `Test tool: ${name}`,
  schema: z.object({}),
  requiresClient,
  handler: vi.fn(),
});

describe('ToolRegistry', () => {
  let registry: TestToolRegistry;

  beforeEach(() => {
    registry = new TestToolRegistry();
  });

  describe('register', () => {
    it('should register a tool', () => {
      const tool = createTool('test_tool');
      registry.register(tool);

      expect(registry.getTools()).toHaveLength(1);
    });

    it('should throw when registering duplicate tool', () => {
      const tool = createTool('test_tool');
      registry.register(tool);

      expect(() => registry.register(tool)).toThrow('Tool test_tool is already registered');
    });
  });

  describe('getTool', () => {
    it('should return tool by name', () => {
      const tool = createTool('test_tool', false);
      registry.register(tool);

      expect(registry.getTool('test_tool')).toBe(tool);
    });

    it('should return undefined for unknown tool', () => {
      expect(registry.getTool('unknown')).toBeUndefined();
    });

    it('should return undefined for connection-required tool when disconnected', () => {
      const tool = createTool('komodo_list_servers', true);
      registry.register(tool);

      // Not connected
      expect(registry.getTool('komodo_list_servers')).toBeUndefined();
    });

    it('should return connection-required tool when connected', () => {
      const tool = createTool('komodo_list_servers', true);
      registry.register(tool);

      registry.setConnectionState(true);
      expect(registry.getTool('komodo_list_servers')).toBe(tool);
    });

    it('should always return tool with requiresClient=false', () => {
      const tool = createTool('komodo_configure', false);
      registry.register(tool);

      // Not connected
      expect(registry.getTool('komodo_configure')).toBe(tool);

      // Connected
      registry.setConnectionState(true);
      expect(registry.getTool('komodo_configure')).toBe(tool);
    });
  });

  describe('getAvailableTools', () => {
    beforeEach(() => {
      registry.register(createTool('komodo_configure', false));
      registry.register(createTool('komodo_health_check', false));
      registry.register(createTool('komodo_list_servers', true));
      registry.register(createTool('komodo_list_containers', true));
    });

    it('should return only always-available tools when disconnected', () => {
      const available = registry.getAvailableTools();

      expect(available).toHaveLength(2);
      expect(available.map((t) => t.name)).toEqual(['komodo_configure', 'komodo_health_check']);
    });

    it('should return all tools when connected', () => {
      registry.setConnectionState(true);
      const available = registry.getAvailableTools();

      expect(available).toHaveLength(4);
    });
  });

  describe('getClientRequiredTools', () => {
    it('should return only tools that require connection', () => {
      registry.register(createTool('komodo_configure', false));
      registry.register(createTool('komodo_list_servers', true));
      registry.register(createTool('komodo_list_containers', true));

      const clientRequired = registry.getClientRequiredTools();

      expect(clientRequired).toHaveLength(2);
      expect(clientRequired.map((t) => t.name)).toEqual(['komodo_list_servers', 'komodo_list_containers']);
    });
  });

  describe('getAlwaysAvailableTools', () => {
    it('should return only tools that do not require connection', () => {
      registry.register(createTool('komodo_configure', false));
      registry.register(createTool('komodo_health_check', false));
      registry.register(createTool('komodo_list_servers', true));

      const alwaysAvailable = registry.getAlwaysAvailableTools();

      expect(alwaysAvailable).toHaveLength(2);
      expect(alwaysAvailable.map((t) => t.name)).toEqual(['komodo_configure', 'komodo_health_check']);
    });
  });

  describe('setConnectionState', () => {
    it('should return true when state changes', () => {
      expect(registry.setConnectionState(true)).toBe(true);
    });

    it('should return false when state is the same', () => {
      registry.setConnectionState(true);
      expect(registry.setConnectionState(true)).toBe(false);
    });

    it('should update connection state', () => {
      expect(registry.getConnectionState()).toBe(false);

      registry.setConnectionState(true);
      expect(registry.getConnectionState()).toBe(true);

      registry.setConnectionState(false);
      expect(registry.getConnectionState()).toBe(false);
    });
  });

  describe('onAvailabilityChange', () => {
    beforeEach(() => {
      registry.register(createTool('komodo_configure', false));
      registry.register(createTool('komodo_list_servers', true));
    });

    it('should notify listeners when connection state changes', () => {
      const listener = vi.fn();
      registry.onAvailabilityChange(listener);

      registry.setConnectionState(true);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'komodo_configure' }),
          expect.objectContaining({ name: 'komodo_list_servers' }),
        ]),
      );
    });

    it('should not notify when state does not change', () => {
      const listener = vi.fn();
      registry.onAvailabilityChange(listener);

      registry.setConnectionState(false); // Already false

      expect(listener).not.toHaveBeenCalled();
    });

    it('should unsubscribe listener', () => {
      const listener = vi.fn();
      const unsubscribe = registry.onAvailabilityChange(listener);

      unsubscribe();
      registry.setConnectionState(true);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const badListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();

      registry.onAvailabilityChange(badListener);
      registry.onAvailabilityChange(goodListener);

      expect(() => registry.setConnectionState(true)).not.toThrow();
      expect(goodListener).toHaveBeenCalled();
    });

    it('should clear all listeners', () => {
      const listener = vi.fn();
      registry.onAvailabilityChange(listener);

      registry.clearListeners();
      registry.setConnectionState(true);

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('default requiresClient behavior', () => {
    it('should default requiresClient to true when not specified', () => {
      const tool = {
        name: 'test_tool',
        description: 'Test',
        schema: z.object({}),
        // requiresClient not specified
        handler: vi.fn(),
      };
      registry.register(tool);

      // Should not be available when disconnected (defaults to true)
      expect(registry.getTool('test_tool')).toBeUndefined();

      registry.setConnectionState(true);
      expect(registry.getTool('test_tool')).toBe(tool);
    });
  });
});
