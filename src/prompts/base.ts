/**
 * Prompt Registry
 *
 * Provides infrastructure for MCP Prompts.
 * Prompts are reusable templates that help users accomplish specific tasks.
 *
 * Per MCP Spec 2025-11-25:
 * - Prompts can accept arguments
 * - Prompts return messages for the conversation
 * - Server can notify clients of prompt list changes
 *
 * Future use cases:
 * - Komodo deployment workflows
 * - Container troubleshooting guides
 * - Stack management templates
 *
 * @see https://modelcontextprotocol.io/specification/2025-11-25/server/prompts
 */

import { z } from 'zod';

/**
 * Message role in a prompt
 */
type PromptRole = 'user' | 'assistant';

/**
 * Content types for prompt messages - aligned with MCP SDK types
 */
interface TextContent {
  type: 'text';
  text: string;
}

interface ImageContent {
  type: 'image';
  data: string; // Base64 encoded
  mimeType: string;
}

// Note: ResourceContent in prompts is different from resource results
// It embeds resource content directly in the message
interface EmbeddedResourceContent {
  type: 'resource';
  resource:
    | {
        uri: string;
        mimeType?: string;
        text: string;
      }
    | {
        uri: string;
        mimeType?: string;
        blob: string;
      };
}

type PromptContent = TextContent | ImageContent | EmbeddedResourceContent;

/**
 * A message in a prompt response
 */
interface PromptMessage {
  role: PromptRole;
  content: PromptContent;
}

/**
 * Argument definition for a prompt
 */
interface PromptArgument {
  /** Argument name */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Whether this argument is required */
  required?: boolean;
}

/**
 * Definition of an MCP Prompt
 *
 * @remarks
 * The `any` types for argumentsSchema and handler args are intentional because:
 * 1. Prompt arguments come from client input and are validated at runtime
 * 2. Zod schemas handle type safety for argument validation
 * 3. TypeScript cannot infer dynamic prompt argument types at compile time
 */
interface Prompt {
  /** Unique name of the prompt */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Arguments this prompt accepts */
  arguments?: PromptArgument[];
  /** Zod schema for validating arguments (optional, for type safety) */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Intentional: Schema type varies per prompt
  argumentsSchema?: z.ZodSchema<any>;
  /** Handler to generate the prompt messages */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Intentional: Args validated by schema at runtime
  handler: (args: Record<string, any>) => Promise<{
    description?: string;
    messages: PromptMessage[];
  }>;
}

/**
 * Registry for managing available prompts.
 *
 * When prompts are registered, the server should advertise
 * the `prompts` capability to clients.
 * @internal Not exported - use promptRegistry instance instead
 */
class PromptRegistry {
  private prompts: Map<string, Prompt> = new Map();

  /**
   * Registers a prompt.
   * @throws Error if a prompt with the same name is already registered.
   */
  register(prompt: Prompt): void {
    if (this.prompts.has(prompt.name)) {
      throw new Error(`Prompt ${prompt.name} is already registered`);
    }
    this.prompts.set(prompt.name, prompt);
  }

  /**
   * Retrieves a prompt by name.
   */
  getPrompt(name: string): Prompt | undefined {
    return this.prompts.get(name);
  }

  /**
   * Returns all registered prompts.
   */
  getPrompts(): Prompt[] {
    return Array.from(this.prompts.values());
  }

  /**
   * Returns true if any prompts are registered.
   */
  hasPrompts(): boolean {
    return this.prompts.size > 0;
  }

  /**
   * Returns the count of registered prompts.
   */
  getCount(): number {
    return this.prompts.size;
  }
}

/** Singleton instance */
export const promptRegistry = new PromptRegistry();
