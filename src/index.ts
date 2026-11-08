#!/usr/bin/env node
/**
 * Komodo MCP Server — Entry Point
 *
 * The settings are read while the server module loads, before anything could catch an error.
 * Loading it here instead lets a start that fails on its settings say so in a few lines on
 * stderr: what is wrong and what to do, without a stack trace or a raw validation dump. That
 * output often ends up in an MCP client's log, where the one line that matters has to stand out.
 */

import { ConfigurationError } from "mcp-server-framework";

try {
  await import("./server.js");
} catch (error) {
  process.stderr.write(describeStartupFailure(error));
  process.exit(1);
}

function describeStartupFailure(error: unknown): string {
  if (error instanceof ConfigurationError) {
    const hint = error.recoveryHint ? `\n${error.recoveryHint}` : "";
    return `Komodo MCP Server could not start:\n${error.message}${hint}\n`;
  }
  // Anything else is not a matter of settings: keep the stack for the bug report.
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
  return `Komodo MCP Server could not start:\n${detail}\n`;
}
