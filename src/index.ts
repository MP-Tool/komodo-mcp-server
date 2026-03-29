#!/usr/bin/env node
/**
 * Komodo MCP Server — Entry Point
 *
 * Creates and starts the MCP server with all Komodo tools auto-registered.
 */

// Must be first import — polyfills localStorage for mogh_auth_client (Node.js)
import "./utils/polyfills.js";

import { createServer, logger } from "mcp-server-framework";
import { SERVER_NAME, SERVER_VERSION, registerKomodoConfigSection } from "./config/index.js";
import { initializeKomodoClientFromEnv, komodoConnection } from "./client.js";
import { getKomodoCredentials } from "./config/index.js";

// Side-effect imports — register all tools in the global registry
import "./tools/index.js";

// Register [komodo] config file section before server init
registerKomodoConfigSection();

// ============================================================================
// Server Instance
// ============================================================================

const { start } = createServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,

  capabilities: {
    tools: { listChanged: true },
    logging: true,
  },

  lifecycle: {
    onStarting: initializeKomodoClientFromEnv,
    onStopping: () => {
      komodoConnection.stopMonitoring();
    },
  },

  health: {
    readinessCheck: () => {
      if (!getKomodoCredentials().url) return true;
      return komodoConnection.connected || "Komodo API not connected";
    },
    serviceLabel: "komodo",
  },

  shutdown: {
    timeoutMs: 10_000,
    forceExitOnTimeout: true,
    signals: ["SIGINT", "SIGTERM"],
  },
});

// ============================================================================
// Start
// ============================================================================

start().catch((error: unknown) => {
  logger.error("Failed to start Komodo MCP Server: %s", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
