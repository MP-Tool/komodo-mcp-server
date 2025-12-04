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

// Komodo MCP server - Container Management Server
class KomodoMCPServer {
  private komodoClient: KomodoClient | null = null;

  constructor() {
    // Register all tools
    registerTools();
    
    // Handle SIGINT globally
    process.on('SIGINT', async () => {
      process.exit(0);
    });
  }

  private createMcpServer(): McpServer {
    const server = new McpServer(
      {
        name: 'komodo-mcp-gateway',
        version: config.VERSION,
      }
    );

    server.server.onerror = (error) => {
      console.error('[MCP Error]', error);
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
          try {
            return await tool.handler(args, {
              client: this.komodoClient,
              setClient: (client: KomodoClient) => {
                this.komodoClient = client;
              }
            });
          } catch (error) {
            if (error instanceof McpError) {
              throw error;
            }
            throw new McpError(
              ErrorCode.InternalError,
              `Error executing ${tool.name}: ${error instanceof Error ? error.message : String(error)}`
            );
          }
        }
      );
    }
    
    return server;
  }

  async run(): Promise<void> {
    // Try to initialize client from environment variables
    if (config.KOMODO_URL && config.KOMODO_USERNAME && config.KOMODO_PASSWORD) {
      try {
        console.error(`Attempting auto-configuration for ${config.KOMODO_URL}...`);
        this.komodoClient = await KomodoClient.login(
          config.KOMODO_URL,
          config.KOMODO_USERNAME,
          config.KOMODO_PASSWORD
        );
        console.error('✅ Auto-configuration successful');
      } catch (error) {
        console.error('⚠️ Auto-configuration failed:', error instanceof Error ? error.message : String(error));
      }
    }

    if (config.MCP_TRANSPORT === 'sse') {
      // Pass factory function to create a new server instance per connection
      await startHttpServer(() => this.createMcpServer());
      console.error(`Komodo MCP server started (SSE Mode) on port ${config.MCP_PORT}`);
    } else if (config.MCP_TRANSPORT === 'stdio') {
      const server = this.createMcpServer();
      const transport = new StdioServerTransport();
      await server.connect(transport);
      console.error('Komodo MCP server started (Stdio Mode)');
    } else {
      throw new Error(`Unsupported MCP_TRANSPORT: ${config.MCP_TRANSPORT}`);
    }
  }
}

// Start the server
const server = new KomodoMCPServer();
server.run().catch(console.error);
