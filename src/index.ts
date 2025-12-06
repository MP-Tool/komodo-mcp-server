#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { KomodoClient } from './api/komodo-client.js';
import { registerTools, toolRegistry } from './tools/index.js';
import { config } from './config/env.js';
import { startHttpServer } from './transport/http-server.js';
import { logger, LogLevel } from './utils/logger.js';

// Komodo MCP server - Container Management Server
class KomodoMCPServer {
  private komodoClient: KomodoClient | null = null;

  constructor() {
    // Register all tools
    registerTools();
    
    // Handle SIGINT globally
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down...');
      process.exit(0);
    });
  }

  private mapLogLevel(level: LogLevel): 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency' {
    switch (level) {
      case 'trace': return 'debug';
      case 'debug': return 'debug';
      case 'info': return 'info';
      case 'warn': return 'warning';
      case 'error': return 'error';
      default: return 'info';
    }
  }

  private createMcpServer(): McpServer {
    const server = new McpServer(
      {
        name: 'komodo-mcp-gateway',
        version: config.VERSION,
      }
    );

    server.server.onerror = (error) => {
      logger.error('MCP Error:', error);
    };

    const tools = toolRegistry.getTools();

    for (const tool of tools) {
      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: tool.schema,
        },
        async (args) => {
          // Get existing context (to preserve sessionId)
          const existingContext = logger.getContext();

          // Create a context for this execution
          const context = {
            sessionId: existingContext?.sessionId,
            requestId: Math.random().toString(36).substring(7),
            sendMcpLog: (level: LogLevel, message: string) => {
              server.server.sendLoggingMessage({
                level: this.mapLogLevel(level),
                data: message
              }).catch(() => {
                // Ignore errors sending logs to client (e.g. if disconnected)
              });
            }
          };

          return logger.runWithContext(context, async () => {
            try {
              logger.info(`Executing tool: ${tool.name}`, args);
              const result = await tool.handler(args, {
                client: this.komodoClient,
                setClient: (client: KomodoClient) => {
                  this.komodoClient = client;
                }
              });
              logger.debug(`Tool execution successful: ${tool.name}`);
              return result;
            } catch (error) {
              logger.error(`Error executing ${tool.name}:`, error);
              if (error instanceof McpError) {
                throw error;
              }
              throw new McpError(
                ErrorCode.InternalError,
                `Error executing ${tool.name}: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          });
        }
      );
    }
    
    return server;
  }

  async run(): Promise<void> {
    if (config.MCP_TRANSPORT === 'sse') {
      // Pass factory function to create a new server instance per connection
      await startHttpServer(() => this.createMcpServer());
      logger.info(`Komodo MCP server started (SSE Mode) on port ${config.MCP_PORT}`);
    } else if (config.MCP_TRANSPORT === 'stdio') {
      const server = this.createMcpServer();
      const transport = new StdioServerTransport();
      await server.connect(transport);
      logger.info('Komodo MCP server started (Stdio Mode)');
    } else {
      throw new Error(`Unsupported MCP_TRANSPORT: ${config.MCP_TRANSPORT}`);
    }

    // Try to initialize client from environment variables
    if (config.KOMODO_URL && config.KOMODO_USERNAME && config.KOMODO_PASSWORD) {
      try {
        logger.info(`Attempting auto-configuration for ${config.KOMODO_URL}...`);
        this.komodoClient = await KomodoClient.login(
          config.KOMODO_URL,
          config.KOMODO_USERNAME,
          config.KOMODO_PASSWORD
        );
        logger.info('✅ Auto-configuration successful');
      } catch (error) {
        logger.warn('⚠️ Auto-configuration failed: %s', error instanceof Error ? error.message : String(error));
      }
    }
  }
}

// Start the server
const server = new KomodoMCPServer();
server.run().catch((error) => {
    logger.error('Fatal error running server:', error);
    process.exit(1);
});
