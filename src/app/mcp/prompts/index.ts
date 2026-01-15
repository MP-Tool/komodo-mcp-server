/**
 * Prompts Module
 *
 * Provides prompt registry instance for registering and managing MCP prompts.
 * Types are exported for prompt implementations.
 */

export {
  promptRegistry,
  type Prompt,
  type PromptArgument,
  type PromptArguments,
  type PromptMessage,
  type PromptResult,
  type PromptContent,
  type PromptRole,
} from './base.js';

// Export factory functions
export {
  createTroubleshootingPrompt,
  createWorkflowPrompt,
  createInfoPrompt,
  registerTroubleshootingPrompt,
  registerWorkflowPrompt,
  registerInfoPrompt,
  type PromptArgumentConfig,
  type TroubleshootingPromptConfig,
  type WorkflowPromptConfig,
  type InfoPromptConfig,
} from './factory.js';

import { registerExamplePrompt } from './example-troubleshoot.js';

/**
 * Register all prompts.
 * Call this function during server initialization.
 *
 * Prompts provide reusable conversation templates that MCP clients can invoke.
 * They can include:
 * - Arguments for customization
 * - Multi-turn conversations (user + assistant messages)
 * - Dynamic content generation
 *
 * @example Adding a new prompt
 * ```typescript
 * import { registerMyPrompt } from './my-prompt.js';
 *
 * export function registerPrompts(): void {
 *   registerExampleTroubleshootPrompt();  // Keep for reference
 *   registerMyPrompt();                    // Add your prompt
 * }
 * ```
 */
export function registerPrompts(): void {
  // Example prompt - demonstrates prompt implementation pattern
  // See example-troubleshoot.ts for implementation details
  registerExamplePrompt();

  // FUTURE: Production prompts (v1.2.0+)
  // - deploy-workflow: Guided deployment workflow
  // - stack-management: Stack lifecycle management
}
