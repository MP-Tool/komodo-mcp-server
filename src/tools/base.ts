import { z } from 'zod';
import { KomodoClient } from '../api/index.js';

/**
 * Context passed to tool handlers.
 * Contains the Komodo client instance and a setter to update it.
 */
export interface ToolContext {
  client: KomodoClient | null;
  setClient: (client: KomodoClient) => void;
}

/**
 * Definition of an MCP Tool.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface Tool<T = any> {
  /** Unique name of the tool (e.g., 'komodo_list_servers') */
  name: string;
  /** Human-readable description of what the tool does */
  description: string;
  /** Zod schema for validating tool arguments */
  schema: z.ZodSchema<T>;
  /** Whether the tool requires an authenticated client (default: true) */
  requiresClient?: boolean;
  /** The function that executes the tool logic */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (args: T, context: ToolContext) => Promise<any>;
}

/**
 * Registry for managing available tools.
 */
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

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
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * Returns all registered tools.
   */
  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }
}

export const toolRegistry = new ToolRegistry();
