import { z } from 'zod';
import { KomodoClient } from '../api/komodo-client.js';

export interface ToolContext {
  client: KomodoClient | null;
  setClient: (client: KomodoClient) => void;
}

export interface Tool<T = any> {
  name: string;
  description: string;
  schema: z.ZodSchema<T>;
  requiresClient?: boolean;
  handler: (args: T, context: ToolContext) => Promise<any>;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool ${tool.name} is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }
}

export const toolRegistry = new ToolRegistry();
