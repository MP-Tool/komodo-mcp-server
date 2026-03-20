/**
 * Prompt Configuration
 *
 * Local configuration for MCP Prompts module.
 * Contains prompt categories, defaults, and metadata.
 *
 * This configuration is aggregated into the global MCP config at `src/config/mcp.config.ts`.
 *
 * @module mcp/prompts/config
 */

// ============================================================================
// Prompt Categories
// ============================================================================

/**
 * Available prompt categories.
 * Used for organizing and filtering prompts.
 */
// prettier-ignore
export const PROMPT_CATEGORIES = [
  'troubleshooting',
  'deployment',
  'monitoring',
  'workflow',
  'info',
] as const;

export type PromptCategory = (typeof PROMPT_CATEGORIES)[number];

// ============================================================================
// Prompt Defaults
// ============================================================================

/**
 * Default values for prompt configuration
 */
export const PROMPT_DEFAULTS = {
  /** Default timeout for prompt handlers in milliseconds */
  HANDLER_TIMEOUT_MS: 30000,
  /** Maximum number of messages in a prompt response */
  MAX_MESSAGES: 10,
  /** Maximum length of a single message text content */
  MAX_MESSAGE_LENGTH: 10000,
} as const;

// ============================================================================
// Prompt Metadata
// ============================================================================

/**
 * Metadata about the prompts module
 */
export const PROMPT_METADATA = {
  /** URI scheme for prompt resources */
  URI_SCHEME: 'komodo-prompt',
  /** Version of the prompt implementation */
  VERSION: '1.0.0',
} as const;

// ============================================================================
// Aggregated Export
// ============================================================================

/**
 * Complete prompt configuration object.
 * Used by the global MCP config aggregator.
 */
export const PROMPT_CONFIG = {
  categories: PROMPT_CATEGORIES,
  defaults: PROMPT_DEFAULTS,
  metadata: PROMPT_METADATA,
} as const;

export type PromptConfig = typeof PROMPT_CONFIG;
