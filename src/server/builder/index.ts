/**
 * Server Builder Module
 *
 * Provides a fluent, declarative API for constructing MCP servers.
 * This module is the primary entry point for creating servers with the framework.
 *
 * @module server/builder
 *
 * @example Basic usage
 * ```typescript
 * import { McpServerBuilder } from './server/builder/index.js';
 *
 * const server = new McpServerBuilder<MyClient>()
 *   .withOptions({ name: 'my-server', version: '1.0.0' })
 *   .withToolProvider(toolRegistry)
 *   .build();
 *
 * await server.start();
 * ```
 */

// Main builder class
export { McpServerBuilder } from './server-builder.js';

// Types
export type {
  // Builder interface
  IServerBuilder,
  IBuilderState,
  // Tool types
  IToolDefinition,
  IToolProvider,
  // Resource types
  IResourceDefinition,
  IResourceTemplateDefinition,
  IResourceContent,
  ITextResourceContent,
  IBlobResourceContent,
  IResourceProvider,
  // Prompt types
  IPromptDefinition,
  IPromptArgumentDefinition,
  IPromptMessageDefinition,
  IPromptResult,
  IPromptProvider,
} from './types.js';

export { createBuilderState } from './types.js';

// Constants
export {
  BuilderMessages,
  BuilderLogMessages,
  DEFAULT_SERVER_NAME,
  DEFAULT_SERVER_VERSION,
  BUILDER_LOG_COMPONENT,
} from './constants.js';
