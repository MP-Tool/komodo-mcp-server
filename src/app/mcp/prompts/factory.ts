/**
 * Prompt Factory
 *
 * Provides factory functions to reduce boilerplate when creating MCP prompts.
 * Supports common patterns like troubleshooting guides, operational workflows,
 * and information gathering prompts.
 *
 * @module prompts/factory
 */

import { promptRegistry, type Prompt, type PromptArgument, type PromptResult } from './base.js';

/**
 * Message role type
 */
type PromptRole = 'user' | 'assistant';

/**
 * Base configuration for prompt arguments
 */
export interface PromptArgumentConfig {
  /** Argument name */
  name: string;
  /** Human-readable description */
  description: string;
  /** Whether this argument is required */
  required?: boolean;
  /** Default value if not provided */
  defaultValue?: string;
}

/**
 * Configuration for creating a troubleshooting prompt
 */
export interface TroubleshootingPromptConfig {
  /** Prompt name (e.g., 'troubleshoot-container') */
  name: string;
  /** Prompt description */
  description: string;
  /** Arguments the prompt accepts */
  promptArguments: PromptArgumentConfig[];
  /** Function to generate issue-specific troubleshooting steps */
  getTroubleshootingSteps: (args: Record<string, string | undefined>) => string;
  /** Initial user message template */
  userMessageTemplate: (args: Record<string, string | undefined>) => string;
  /** Tool recommendations for the assistant */
  recommendedTools?: string[];
}

/**
 * Configuration for creating an operational workflow prompt
 */
export interface WorkflowPromptConfig {
  /** Prompt name */
  name: string;
  /** Prompt description */
  description: string;
  /** Arguments the prompt accepts */
  promptArguments: PromptArgumentConfig[];
  /** Workflow steps to include */
  workflowSteps: string[];
  /** Initial user message template */
  userMessageTemplate: (args: Record<string, string | undefined>) => string;
  /** Prerequisites before starting */
  prerequisites?: string[];
  /** Expected outcomes */
  expectedOutcomes?: string[];
}

/**
 * Configuration for creating an info-gathering prompt
 */
export interface InfoPromptConfig {
  /** Prompt name */
  name: string;
  /** Prompt description */
  description: string;
  /** Arguments the prompt accepts */
  promptArguments: PromptArgumentConfig[];
  /** What information to gather */
  infoToGather: string[];
  /** Initial user message template */
  userMessageTemplate: (args: Record<string, string | undefined>) => string;
  /** Tools to use for gathering info */
  toolsToUse: string[];
}

/**
 * Creates a troubleshooting prompt with consistent pattern.
 *
 * @param config - The prompt configuration
 * @returns A Prompt definition
 *
 * @example
 * ```typescript
 * createTroubleshootingPrompt({
 *   name: 'troubleshoot-container',
 *   description: 'Helps troubleshoot container issues',
 *   promptArguments: [
 *     { name: 'container_name', description: 'Container name', required: true },
 *     { name: 'issue_type', description: 'Type of issue', required: false },
 *   ],
 *   getTroubleshootingSteps: (args) => getStepsForIssue(args.issue_type),
 *   userMessageTemplate: (args) => `Help with ${args.container_name}`,
 *   recommendedTools: ['komodo_get_container_logs', 'komodo_inspect_container'],
 * });
 * ```
 */
export function createTroubleshootingPrompt(config: TroubleshootingPromptConfig): Prompt {
  const {
    name,
    description,
    promptArguments: promptArgs,
    getTroubleshootingSteps,
    userMessageTemplate,
    recommendedTools = [],
  } = config;

  return {
    name,
    description,
    arguments: promptArgs.map((arg) => ({
      name: arg.name,
      description: arg.description,
      required: arg.required ?? false,
    })),
    handler: async (args) => {
      // Normalize arguments with defaults
      const normalizedArgs: Record<string, string | undefined> = {};
      for (const argConfig of promptArgs) {
        const value = args[argConfig.name];
        normalizedArgs[argConfig.name] = value !== undefined ? String(value) : argConfig.defaultValue;
      }

      const troubleshootingSteps = getTroubleshootingSteps(normalizedArgs);
      const userMessage = userMessageTemplate(normalizedArgs);

      // Build tool recommendations
      let toolSection = '';
      if (recommendedTools.length > 0) {
        const toolList = recommendedTools.map((t) => `\`${t}\``).join(', ');
        toolSection = `\n\n**Recommended Tools:** ${toolList}`;
      }

      return {
        description: `Troubleshooting guide: ${name}`,
        messages: [
          {
            role: 'user' as PromptRole,
            content: { type: 'text', text: userMessage },
          },
          {
            role: 'assistant' as PromptRole,
            content: {
              type: 'text',
              text: `I'll help you troubleshoot this issue.\n\n${troubleshootingSteps}${toolSection}\n\nWould you like me to proceed with these diagnostic steps?`,
            },
          },
        ],
      };
    },
  };
}

/**
 * Creates an operational workflow prompt with consistent pattern.
 *
 * @param config - The prompt configuration
 * @returns A Prompt definition
 */
export function createWorkflowPrompt(config: WorkflowPromptConfig): Prompt {
  const {
    name,
    description,
    promptArguments: promptArgs,
    workflowSteps,
    userMessageTemplate,
    prerequisites = [],
    expectedOutcomes = [],
  } = config;

  return {
    name,
    description,
    arguments: promptArgs.map((arg) => ({
      name: arg.name,
      description: arg.description,
      required: arg.required ?? false,
    })),
    handler: async (args) => {
      // Normalize arguments
      const normalizedArgs: Record<string, string | undefined> = {};
      for (const argConfig of promptArgs) {
        const value = args[argConfig.name];
        normalizedArgs[argConfig.name] = value !== undefined ? String(value) : argConfig.defaultValue;
      }

      const userMessage = userMessageTemplate(normalizedArgs);

      // Build workflow content
      const stepsFormatted = workflowSteps.map((step, i) => `${i + 1}. ${step}`).join('\n');

      let prerequisitesSection = '';
      if (prerequisites.length > 0) {
        prerequisitesSection = `\n\n**Prerequisites:**\n${prerequisites.map((p) => `- ${p}`).join('\n')}`;
      }

      let outcomesSection = '';
      if (expectedOutcomes.length > 0) {
        outcomesSection = `\n\n**Expected Outcomes:**\n${expectedOutcomes.map((o) => `- ${o}`).join('\n')}`;
      }

      return {
        description: `Workflow: ${name}`,
        messages: [
          {
            role: 'user' as PromptRole,
            content: { type: 'text', text: userMessage },
          },
          {
            role: 'assistant' as PromptRole,
            content: {
              type: 'text',
              text: `I'll guide you through this workflow.${prerequisitesSection}\n\n**Steps:**\n${stepsFormatted}${outcomesSection}\n\nShall I begin with step 1?`,
            },
          },
        ],
      };
    },
  };
}

/**
 * Creates an info-gathering prompt with consistent pattern.
 *
 * @param config - The prompt configuration
 * @returns A Prompt definition
 */
export function createInfoPrompt(config: InfoPromptConfig): Prompt {
  const { name, description, promptArguments: promptArgs, infoToGather, userMessageTemplate, toolsToUse } = config;

  return {
    name,
    description,
    arguments: promptArgs.map((arg) => ({
      name: arg.name,
      description: arg.description,
      required: arg.required ?? false,
    })),
    handler: async (args) => {
      // Normalize arguments
      const normalizedArgs: Record<string, string | undefined> = {};
      for (const argConfig of promptArgs) {
        const value = args[argConfig.name];
        normalizedArgs[argConfig.name] = value !== undefined ? String(value) : argConfig.defaultValue;
      }

      const userMessage = userMessageTemplate(normalizedArgs);

      const infoList = infoToGather.map((info) => `- ${info}`).join('\n');
      const toolList = toolsToUse.map((t) => `\`${t}\``).join(', ');

      return {
        description: `Information gathering: ${name}`,
        messages: [
          {
            role: 'user' as PromptRole,
            content: { type: 'text', text: userMessage },
          },
          {
            role: 'assistant' as PromptRole,
            content: {
              type: 'text',
              text: `I'll gather the following information:\n${infoList}\n\n**Tools I'll use:** ${toolList}\n\nLet me start collecting this information.`,
            },
          },
        ],
      };
    },
  };
}

/**
 * Registers a troubleshooting prompt with the registry.
 *
 * @param config - The prompt configuration
 */
export function registerTroubleshootingPrompt(config: TroubleshootingPromptConfig): void {
  const prompt = createTroubleshootingPrompt(config);
  promptRegistry.register(prompt);
}

/**
 * Registers a workflow prompt with the registry.
 *
 * @param config - The prompt configuration
 */
export function registerWorkflowPrompt(config: WorkflowPromptConfig): void {
  const prompt = createWorkflowPrompt(config);
  promptRegistry.register(prompt);
}

/**
 * Registers an info-gathering prompt with the registry.
 *
 * @param config - The prompt configuration
 */
export function registerInfoPrompt(config: InfoPromptConfig): void {
  const prompt = createInfoPrompt(config);
  promptRegistry.register(prompt);
}
