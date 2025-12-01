#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { KomodoClient } from './api/komodo-client.js';
import { registerTools, toolRegistry } from './tools/index.js';
import { config } from './config/env.js';

// Komodo MCP server - Container Management Server
class KomodoMCPServer {
  private server: McpServer;
  private komodoClient: KomodoClient | null = null;

  constructor() {
    this.server = new McpServer(
      {
        name: 'komodo-mcp-gateway',
        version: config.VERSION,
      }
    );

    // Register all tools
    registerTools();

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    const tools = toolRegistry.getTools();

    for (const tool of tools) {
      this.server.registerTool(
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

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Komodo MCP server started');
  }
}

// Start the server
const server = new KomodoMCPServer();
server.run().catch(console.error);
