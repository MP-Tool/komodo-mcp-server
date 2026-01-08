import { z } from 'zod';
import { KomodoClient } from '../api/index.js';
import { ProgressData } from '../utils/request-manager.js';

/**
 * Context passed to tool handlers.
 * Contains the Komodo client instance, progress reporting, and cancellation support.
 */
export interface ToolContext {
  /** The authenticated Komodo client (null if not configured) */
  client: KomodoClient | null;
  /** Sets a new Komodo client instance (used by configure tool) */
  setClient: (client: KomodoClient) => void;

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
 * @internal Not exported - use toolRegistry instance instead
 */
class ToolRegistry {
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
