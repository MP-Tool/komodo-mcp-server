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
 * Result of a prompt handler
 */
interface PromptResult {
  description?: string;
  messages: PromptMessage[];
}

/**
 * Generic prompt arguments type - represents validated arguments from client
 * Using Record with string keys allows flexible argument structures
 * while still providing type information for common use cases.
 */
type PromptArguments = Record<string, string | number | boolean | undefined>;

/**
 * Definition of an MCP Prompt
 *
 * @typeParam TArgs - The type of arguments this prompt accepts, defaults to PromptArguments
 *
 * @remarks
 * Prompts use Zod schemas for runtime validation of arguments.
 * The generic parameter provides compile-time type safety for the handler.
 */
interface Prompt<TArgs extends PromptArguments = PromptArguments> {
  /** Unique name of the prompt */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Arguments this prompt accepts */
  arguments?: PromptArgument[];
  /** Zod schema for validating arguments (optional, for type safety) */
  argumentsSchema?: z.ZodSchema<TArgs>;
  /** Handler to generate the prompt messages */
  handler: (args: TArgs) => Promise<PromptResult>;
}

/**
 * Registry for managing available prompts.
 *
 * When prompts are registered, the server should advertise
 * the `prompts` capability to clients.
 * @internal Not exported - use promptRegistry instance instead
 */
class PromptRegistry {
  private prompts: Map<string, Prompt<PromptArguments>> = new Map();

  /**
   * Registers a prompt.
   * @param prompt - The prompt to register
   * @throws Error if a prompt with the same name is already registered.
   */
  register<TArgs extends PromptArguments>(prompt: Prompt<TArgs>): void {
    if (this.prompts.has(prompt.name)) {
      throw new Error(`Prompt ${prompt.name} is already registered`);
    }
    // Store as base type - runtime validation ensures type safety
    this.prompts.set(prompt.name, prompt as unknown as Prompt<PromptArguments>);
  }

  /**
   * Retrieves a prompt by name.
   * @param name - The name of the prompt to retrieve
   * @returns The prompt if found, undefined otherwise
   */
  getPrompt(name: string): Prompt<PromptArguments> | undefined {
    return this.prompts.get(name);
  }

  /**
   * Returns all registered prompts.
   * @returns Array of all registered prompts
   */
  getPrompts(): Prompt<PromptArguments>[] {
    return Array.from(this.prompts.values());
  }

  /**
   * Returns true if any prompts are registered.
   * @returns boolean indicating if prompts exist
   */
  hasPrompts(): boolean {
    return this.prompts.size > 0;
  }

  /**
   * Returns the count of registered prompts.
   * @returns The number of registered prompts
   */
  getCount(): number {
    return this.prompts.size;
  }
}

/** Singleton instance */
export const promptRegistry = new PromptRegistry();

// Export types for external usage
export type { Prompt, PromptArgument, PromptArguments, PromptMessage, PromptResult, PromptContent, PromptRole };
