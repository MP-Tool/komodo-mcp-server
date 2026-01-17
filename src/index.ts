#!/usr/bin/env node

/**
 * Komodo MCP Server - Main Entry Point
 *
 * Model Context Protocol server for managing Docker containers,
 * deployments, and stacks through Komodo.
 *
 * Uses McpServerBuilder for declarative server construction.
 *
 * @module index
 */

// Initialize OpenTelemetry FIRST, before any other imports
// This ensures all modules are instrumented
import { initializeTelemetry } from './server/telemetry/index.js';
initializeTelemetry();

// Configure logger BEFORE any other imports that use it
// This ensures LOG_LEVEL and other settings from env are applied
import { configureLogger } from './app/framework.js';
import { config, SERVER_NAME, SERVER_VERSION } from './app/config/index.js';
configureLogger({
  LOG_LEVEL: config.LOG_LEVEL,
  LOG_FORMAT: config.LOG_FORMAT,
  LOG_DIR: config.LOG_DIR,
  MCP_TRANSPORT: config.MCP_TRANSPORT,
  NODE_ENV: config.NODE_ENV,
  SERVER_NAME,
  SERVER_VERSION,
});

// Server Builder
import { McpServerBuilder } from './server/builder/index.js';
import type { IServerInstance } from './server/types/index.js';

// Komodo application layer
import type { KomodoClient } from './app/api/index.js';
import { registerTools, toolRegistry } from './app/mcp/tools/index.js';
import { registerResources } from './app/mcp/resources/index.js';
import { registerPrompts } from './app/mcp/prompts/index.js';
import {
  komodoServerOptions,
  toolRegistryAdapter,
  resourceRegistryAdapter,
  promptRegistryAdapter,
  initializeKomodoClientFromEnv,
  komodoConnectionManager,
} from './app/index.js';

// Logger
import { logger } from './server/logger/index.js';

// Store server instance for tool notifications
let serverInstance: IServerInstance | null = null;

/**
 * Bootstrap the Komodo MCP Server.
 *
 * This function:
 * 1. Registers all tools, resources, and prompts with their registries
 * 2. Sets up connection state listener for dynamic tool availability
 * 3. Builds the server using McpServerBuilder with adapters
 * 4. Starts the server
 * 5. Attempts auto-configuration from environment variables
 */
async function main(): Promise<void> {
  // Register all tools, resources, and prompts with their registries
  registerTools();
  registerResources();
  registerPrompts();

  // Set up connection state listener to update tool availability
  // This enables dynamic tool list changes when Komodo connects/disconnects
  komodoConnectionManager.onStateChange((state, client) => {
    const wasConnected = toolRegistry.getConnectionState();
    const isConnected = state === 'connected' && client !== null;

    // Update tool registry state
    const stateChanged = toolRegistry.setConnectionState(isConnected);

    if (stateChanged && serverInstance) {
      // Notify all connected MCP clients that tool list changed
      serverInstance.notifyToolListChanged();
      logger.info('Tool availability changed: %d tools now available', toolRegistry.getAvailableTools().length);
    }

    // Log connection state changes
    if (!wasConnected && isConnected) {
      logger.info('Komodo connected - %d tools now available', toolRegistry.getAvailableTools().length);
    } else if (wasConnected && !isConnected) {
      logger.info('Komodo disconnected - %d tools now available', toolRegistry.getAvailableTools().length);
    }
  });

  // Build server using McpServerBuilder with adapters
  // Note: We use autoConnect: false because we manually call initializeKomodoClientFromEnv()
  // after server start to support Docker env_file loading at runtime
  serverInstance = new McpServerBuilder<KomodoClient>()
    .withOptions(komodoServerOptions)
    .withToolProvider(toolRegistryAdapter)
    .withResourceProvider(resourceRegistryAdapter)
    .withPromptProvider(promptRegistryAdapter)
    .build();

  // Start the server (handles transport selection internally)
  await serverInstance.start();

  // Try to initialize Komodo client from environment variables
  // This is called after server start to support Docker runtime credential loading
  await initializeKomodoClientFromEnv();
}

// Start the server
main().catch((error) => {
  logger.error('Fatal error running server:', error);
  process.exit(1);
});
