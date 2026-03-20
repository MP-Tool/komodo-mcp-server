/**
 * Resource Configuration
 *
 * Local configuration for MCP Resources module.
 * Contains resource categories, defaults, and metadata.
 *
 * This configuration is aggregated into the global MCP config at `src/config/mcp.config.ts`.
 *
 * @module mcp/resources/config
 */

// ============================================================================
// Resource Categories
// ============================================================================

/**
 * Available resource categories.
 * Used for organizing and filtering resources.
 */
// prettier-ignore
export const RESOURCE_CATEGORIES = [
  'server-info',
  'logs',
  'config',
  'status',
  'documentation',
] as const;

export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number];

// ============================================================================
// Resource URI Schemes
// ============================================================================

/**
 * URI scheme configuration for resources.
 * Resources use the `komodo://` scheme following RFC 3986.
 */
export const RESOURCE_URI = {
  /** Base URI scheme for all Komodo resources */
  SCHEME: 'komodo',
  /** Example resource prefix */
  EXAMPLE_PREFIX: 'example',
  /** Server resource prefix */
  SERVER_PREFIX: 'server',
  /** Stack resource prefix */
  STACK_PREFIX: 'stack',
  /** Deployment resource prefix */
  DEPLOYMENT_PREFIX: 'deployment',
} as const;

// ============================================================================
// Resource Defaults
// ============================================================================

/**
 * Default values for resource configuration
 */
export const RESOURCE_DEFAULTS = {
  /** Default MIME type for text resources */
  TEXT_MIME_TYPE: 'text/plain',
  /** Default MIME type for JSON resources */
  JSON_MIME_TYPE: 'application/json',
  /** Default MIME type for Markdown resources */
  MARKDOWN_MIME_TYPE: 'text/markdown',
  /** Maximum size for resource content in bytes */
  MAX_CONTENT_SIZE: 1024 * 1024, // 1MB
  /** Cache TTL for static resources in milliseconds */
  CACHE_TTL_MS: 60000, // 1 minute
} as const;

// ============================================================================
// Resource Metadata
// ============================================================================

/**
 * Metadata about the resources module
 */
export const RESOURCE_METADATA = {
  /** Version of the resource implementation */
  VERSION: '1.0.0',
  /** Supported content types */
  SUPPORTED_MIME_TYPES: ['text/plain', 'application/json', 'text/markdown'] as const,
} as const;

// ============================================================================
// Aggregated Export
// ============================================================================

/**
 * Complete resource configuration object.
 * Used by the global MCP config aggregator.
 */
export const RESOURCE_CONFIG = {
  categories: RESOURCE_CATEGORIES,
  uri: RESOURCE_URI,
  defaults: RESOURCE_DEFAULTS,
  metadata: RESOURCE_METADATA,
} as const;

export type ResourceConfig = typeof RESOURCE_CONFIG;
