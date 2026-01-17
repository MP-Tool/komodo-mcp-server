/**
 * Server Builder Constants
 *
 * Constants and default values for the server builder.
 *
 * @module server/builder/constants
 */

// ============================================================================
// Builder Constants
// ============================================================================

/**
 * Default server name when not specified.
 */
export const DEFAULT_SERVER_NAME = 'mcp-server';

/**
 * Default server version when not specified.
 */
export const DEFAULT_SERVER_VERSION = '1.0.0';

/**
 * Log component name for builder operations.
 */
export const BUILDER_LOG_COMPONENT = 'server-builder';

// ============================================================================
// Builder Error Messages
// ============================================================================

/**
 * Builder-specific error messages.
 */
export const BuilderMessages = {
  // Configuration
  OPTIONS_REQUIRED: 'Server options are required. Call withOptions() before build().',
  OPTIONS_ALREADY_SET: 'Server options have already been configured.',
  NAME_REQUIRED: 'Server name is required in options.',
  VERSION_REQUIRED: 'Server version is required in options.',

  // Registration
  DUPLICATE_TOOL: (name: string) => `Tool '${name}' is already registered.`,
  DUPLICATE_RESOURCE: (uri: string) => `Resource '${uri}' is already registered.`,
  DUPLICATE_PROMPT: (name: string) => `Prompt '${name}' is already registered.`,

  // Build
  BUILD_FAILED: 'Failed to build server instance.',
  INVALID_TRANSPORT: (mode: string) => `Invalid transport mode: '${mode}'.`,

  // Lifecycle
  SERVER_ALREADY_RUNNING: 'Server is already running.',
  SERVER_NOT_RUNNING: 'Server is not running.',
  SHUTDOWN_TIMEOUT: 'Server shutdown timed out.',
  SHUTDOWN_FORCED: 'Forcing server shutdown after timeout.',

  // Runtime
  TOOL_UNAVAILABLE: (name: string) => `Tool '${name}' is not available (client not connected).`,
  TOOL_NOT_FOUND: (name: string) => `Tool '${name}' not found.`,
} as const;

// ============================================================================
// Builder Log Messages
// ============================================================================

/**
 * Log messages for builder operations.
 */
export const BuilderLogMessages = {
  // Configuration
  OPTIONS_CONFIGURED: 'Server options configured: name=%s, version=%s',
  TRANSPORT_CONFIGURED: 'Transport configured: mode=%s',

  // Registration
  TOOLS_REGISTERED: 'Registered %d tools',
  TOOL_REGISTERED: 'Registered tool: %s (requiresClient=%s)',
  RESOURCES_REGISTERED: 'Registered %d resources and %d templates',
  RESOURCE_REGISTERED: 'Registered resource: %s (%s)',
  TEMPLATE_REGISTERED: 'Registered resource template: %s (%s)',
  PROMPTS_REGISTERED: 'Registered %d prompts',
  PROMPT_REGISTERED: 'Registered prompt: %s',

  // Build
  BUILD_STARTED: 'Building server instance...',
  BUILD_COMPLETED: 'Server instance built successfully',
  BUILD_SUMMARY: 'Server ready: %d tools, %d resources, %d prompts',

  // Lifecycle
  SERVER_STARTING: 'Server starting...',
  SERVER_STARTED: 'Server started: %s v%s (%s mode)',
  SERVER_STOPPING: 'Server stopping...',
  SERVER_STOPPED: 'Server stopped',
  SHUTDOWN_SIGNAL: 'Received shutdown signal: %s',
  CLIENT_CONNECTED: 'Client connected: %s',
  CLIENT_DISCONNECTED: 'Client disconnected: %s',
  TOOLS_AVAILABLE: '%d tools now available',
} as const;

// ============================================================================
// Type Exports
// ============================================================================

export type BuilderMessageKey = keyof typeof BuilderMessages;
export type BuilderLogMessageKey = keyof typeof BuilderLogMessages;
