import { z } from 'zod';
import { KomodoClient } from '../api/index.js';
import type { ProgressData } from '../utils/index.js';

/**
 * Context passed to tool handlers.
 * Contains the Komodo client instance, progress reporting, and cancellation support.
 */
export interface ToolContext {
  /** The authenticated Komodo client (null if not configured) */
  client: KomodoClient | null;
  /**
   * Sets a new Komodo client instance (used by configure tool).
   * This updates the connection state and triggers tool availability changes.
   */
  setClient: (client: KomodoClient) => Promise<void>;

  /**
   * Reports progress for long-running operations.
   * Only available if the client requested progress via _meta.progressToken.
   *
   * Per MCP Spec:
   * - Progress value MUST increase with each notification
   * - Progress and total MAY be floating point
   * - Message SHOULD provide relevant human-readable progress information
   *
   * @param data - Progress data to report
   * @returns true if sent, false if not available or rate-limited
   */
  reportProgress?: (data: ProgressData) => Promise<boolean>;

  /**
   * AbortSignal that is triggered when the request is cancelled.
   * Tools SHOULD check this signal periodically for long-running operations
   * and abort if signaled.
   */
  abortSignal?: AbortSignal;
}

/**
 * Definition of an MCP Tool.
 *
 * @typeParam T - The type of arguments the tool accepts (inferred from schema).
 *                Defaults to `unknown` to allow flexible schema definitions while
 *                maintaining type inference at the handler level via Zod.
 *
 * @remarks
 * The `any` default is intentional here because:
 * 1. Zod schemas handle runtime validation
 * 2. TypeScript cannot infer complex schema types at compile time
 * 3. Each tool defines its own schema which provides type safety at usage
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Intentional: Zod handles type safety at runtime
export interface Tool<T = any> {
  /** Unique name of the tool (e.g., 'komodo_list_servers') */
  name: string;
  /** Human-readable description of what the tool does */
  description: string;
  /** Zod schema for validating tool arguments */
  schema: z.ZodSchema<T>;
  /**
   * Whether the tool requires an authenticated Komodo client.
   * Default: true
   *
   * When true:
   * - Tool is only available when connected to Komodo
   * - Tool list changes dynamically based on connection state
   *
   * When false:
   * - Tool is always available (e.g., configure, health_check)
   */
  requiresClient?: boolean;
  /** The function that executes the tool logic */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- MCP SDK accepts flexible return types
  handler: (args: T, context: ToolContext) => Promise<any>;
}

/**
 * Callback type for tool availability changes.
 * @internal Used by ToolRegistry for notifications
 */
type ToolAvailabilityListener = (availableTools: Tool[]) => void;

/**
 * Registry for managing available tools.
 * Supports dynamic tool availability based on connection state.
 *
 * @internal Not exported - use toolRegistry instance instead
 */
class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private isConnected = false;
  private listeners: Set<ToolAvailabilityListener> = new Set();

  /**
   * Registers a new tool.
   * @throws Error if a tool with the same name is already registered.
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Retrieves a tool by name.
   * Only returns tools that are currently available based on connection state.
   */
  getTool(name: string): Tool | undefined {
    const tool = this.tools.get(name);
    if (!tool) return undefined;

    // Check if tool is available
    if (this.requiresConnection(tool) && !this.isConnected) {
      return undefined;
    }

    return tool;
  }

  /**
   * Returns all registered tools (regardless of availability).
   * Use getAvailableTools() for tools available in current state.
   */
  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Returns only tools that are currently available.
   * Tools with requiresClient=true are only available when connected.
   */
  getAvailableTools(): Tool[] {
    return Array.from(this.tools.values()).filter((tool) => {
      if (this.requiresConnection(tool)) {
        return this.isConnected;
      }
      return true;
    });
  }

  /**
   * Returns tools that require a Komodo connection.
   */
  getClientRequiredTools(): Tool[] {
    return Array.from(this.tools.values()).filter((tool) => this.requiresConnection(tool));
  }

  /**
   * Returns tools that are always available (no connection required).
   */
  getAlwaysAvailableTools(): Tool[] {
    return Array.from(this.tools.values()).filter((tool) => !this.requiresConnection(tool));
  }

  /**
   * Update the connection state.
   * When state changes, notifies listeners about tool availability changes.
   *
   * @param connected - Whether the client is connected to Komodo
   * @returns true if the state changed, false otherwise
   */
  setConnectionState(connected: boolean): boolean {
    if (this.isConnected === connected) {
      return false;
    }

    this.isConnected = connected;
    this.notifyListeners();
    return true;
  }

  /**
   * Get the current connection state as tracked by the registry.
   */
  getConnectionState(): boolean {
    return this.isConnected;
  }

  /**
   * Register a listener for tool availability changes.
   *
   * @param listener - Function to call when available tools change
   * @returns Unsubscribe function
   */
  onAvailabilityChange(listener: ToolAvailabilityListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Clear all listeners.
   */
  clearListeners(): void {
    this.listeners.clear();
  }

  /**
   * Check if a tool requires a connection.
   * Default is true (most tools require connection).
   */
  private requiresConnection(tool: Tool): boolean {
    // Default to true if not specified
    return tool.requiresClient !== false;
  }

  /**
   * Notify all listeners about tool availability changes.
   */
  private notifyListeners(): void {
    const availableTools = this.getAvailableTools();
    for (const listener of this.listeners) {
      try {
        listener(availableTools);
      } catch (error) {
        // Log but don't throw - one listener failure shouldn't affect others
        console.error('Error in tool availability listener:', error);
      }
    }
  }
}

export const toolRegistry = new ToolRegistry();
