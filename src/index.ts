#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { KomodoClient, KomodoContainer, KomodoServer, KomodoDeployment, KomodoStack } from './komodo-client.js';

// Komodo MCP server - Container Management Server
class KomodoMCPServer {
  private server: Server;
  private komodoClient: KomodoClient | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'komodo-mcp-gateway',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Container Management
          {
            name: 'komodo_list_containers',
            description: 'List all Docker containers on a server',
            inputSchema: {
              type: 'object',
              properties: {
                server: {
                  type: 'string',
                  description: 'Server ID or name'
                }
              },
              required: ['server']
            }
          },
          {
            name: 'komodo_start_container',
            description: 'Start a Docker container',
            inputSchema: {
              type: 'object',
              properties: {
                server: {
                  type: 'string',
                  description: 'Server ID or name'
                },
                container: {
                  type: 'string',
                  description: 'Container name'
                }
              },
              required: ['server', 'container']
            }
          },
          {
            name: 'komodo_stop_container',
            description: 'Stop a Docker container',
            inputSchema: {
              type: 'object',
              properties: {
                server: {
                  type: 'string',
                  description: 'Server ID or name'
                },
                container: {
                  type: 'string',
                  description: 'Container name'
                }
              },
              required: ['server', 'container']
            }
          },
          {
            name: 'komodo_pause_container',
            description: 'Pause a Docker container',
            inputSchema: {
              type: 'object',
              properties: {
                server: {
                  type: 'string',
                  description: 'Server ID or name'
                },
                container: {
                  type: 'string',
                  description: 'Container name'
                }
              },
              required: ['server', 'container']
            }
          },
          // TODO: Unpause can be removed. Only need Start, Stop, Pause Actions
          {
            name: 'komodo_unpause_container',
            description: 'Unpause a Docker container',
            inputSchema: {
              type: 'object',
              properties: {
                server: {
                  type: 'string',
                  description: 'Server ID or name'
                },
                container: {
                  type: 'string',
                  description: 'Container name'
                }
              },
              required: ['server', 'container']
            }
          },
          // Server Management
          {
            name: 'komodo_list_servers',
            description: 'List all available servers',
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
            }
          },
          {
            name: 'komodo_get_server_stats',
            description: 'Get server statistics and status',
            inputSchema: {
              type: 'object',
              properties: {
                server: {
                  type: 'string',
                  description: 'Server ID or name'
                }
              },
              required: ['server']
            }
          },
          // Deployment Management
          {
            name: 'komodo_list_deployments',
            description: 'List all deployments',
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
            }
          },
          {
            name: 'komodo_deploy_container',
            description: 'Deploy a container',
            inputSchema: {
              type: 'object',
              properties: {
                deployment: {
                  type: 'string',
                  description: 'Deployment ID or name'
                }
              },
              required: ['deployment']
            }
          },
          // Stack Management
          {
            name: 'komodo_list_stacks',
            description: 'List all Docker Compose stacks',
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
            }
          },
          {
            name: 'komodo_stop_stack',
            description: 'Stop a Docker Compose stack',
            inputSchema: {
              type: 'object',
              properties: {
                stack: {
                  type: 'string',
                  description: 'Stack ID or name'
                }
              },
              required: ['stack']
            }
          },
          // Configuration & Health
          {
            name: 'komodo_configure',
            description: 'Configure connection to Komodo server with username and password',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'Komodo server URL (e.g. http://localhost:9121 or http://core:9120)'
                },
                username: {
                  type: 'string',
                  description: 'Komodo username'
                },
                password: {
                  type: 'string',
                  description: 'Komodo password'
                }
              },
              required: ['url', 'username', 'password']
            }
          },
          {
            name: 'komodo_health_check',
            description: 'Check connection to Komodo server and return detailed diagnostic information',
            inputSchema: {
              type: 'object',
              properties: {},
              required: []
            }
          }
        ]
      };
    });

    // Handle Tool Calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Ensure client is configured
        if (name !== 'komodo_configure' && name !== 'komodo_health_check' && !this.komodoClient) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            'Komodo Client not configured. Please use komodo_configure first.'
          );
        }

        switch (name) {
          case 'komodo_configure':
            return await this.handleConfigure(args);
          case 'komodo_health_check':
            return await this.handleHealthCheck(args);
          case 'komodo_list_containers':
            return await this.handleListContainers(args);
          case 'komodo_start_container':
            return await this.handleStartContainer(args);
          case 'komodo_stop_container':
            return await this.handleStopContainer(args);
          case 'komodo_pause_container':
            return await this.handlePauseContainer(args);
          case 'komodo_unpause_container':
            return await this.handleUnpauseContainer(args);
          case 'komodo_list_servers':
            return await this.handleListServers(args);
          case 'komodo_get_server_stats':
            return await this.handleGetServerStats(args);
          case 'komodo_list_deployments':
            return await this.handleListDeployments(args);
          case 'komodo_deploy_container':
            return await this.handleDeployContainer(args);
          case 'komodo_list_stacks':
            return await this.handleListStacks(args);
          case 'komodo_deploy_stack':
            return await this.handleDeployStack(args);
          case 'komodo_stop_stack':
            return await this.handleStopStack(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  // Tool Handler Implementations
  private async handleConfigure(args: any) {
    const schema = z.object({
      url: z.string().url(),
      username: z.string().min(1),
      password: z.string().min(1)
    });

    const { url, username, password } = schema.parse(args);

    try {
      // Login to get JWT-Token
      this.komodoClient = await KomodoClient.login(url, username, password);
      
      // Perform health check after configuration
      const health = await this.komodoClient.healthCheck();

      if (health.status === 'healthy') {
        return {
          content: [{
            type: 'text',
            text: `✅ Komodo Client successfully configured!\n\n` +
                  `🌐 Server: ${url}\n` +
                  `👤 User: ${username}\n` +
                  `⚡ Response Time: ${health.details.responseTime}ms\n` +
                  `🔐 Authentication: OK\n` +
                  `${health.details.apiVersion ? `📦 API Version: ${health.details.apiVersion}\n` : ''}` +
                  `\nReady for container management! 🚀`
          }]
        };
      } else {
        // Configuration created but unhealthy
        return {
          content: [{
            type: 'text',
            text: `⚠️ Login successful, but health check failed:\n\n` +
                  `🌐 Server: ${url}\n` +
                  `👤 User: ${username}\n` +
                  `❌ Status: ${health.message}\n` +
                  `${health.details.error ? `🔍 Details: ${health.details.error}\n` : ''}` +
                  `\nPlease check your configuration!`
          }]
        };
      }
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Failed to configure Komodo client: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async handleHealthCheck(args: any) {
    if (!this.komodoClient) {
      return {
        content: [{
          type: 'text',
          text: `⚠️ Komodo Client not configured\n\n` +
                `Please use 'komodo_configure' first to establish a connection.\n\n` +
                `Required parameters:\n` +
                `• url: Komodo server URL (e.g. http://localhost:9121)\n` +
                `• username: Your Komodo username\n` +
                `• password: Your Komodo password`
        }]
      };
    }

    try {
      const health = await this.komodoClient.healthCheck();

      if (health.status === 'healthy') {
        return {
          content: [{
            type: 'text',
            text: `✅ Komodo server is reachable!\n\n` +
                  `🌐 Server: ${health.details.url}\n` +
                  `⚡ Response Time: ${health.details.responseTime}ms\n` +
                  `🔐 Authentication: ${health.details.authenticated ? '✅ OK' : '❌ Failed'}\n` +
                  `${health.details.apiVersion ? `📦 API Version: ${health.details.apiVersion}\n` : ''}` +
                  `\nStatus: ${health.message} 🎉`
          }]
        };
      } else {
        return {
          content: [{
            type: 'text',
            text: `❌ Komodo server health check failed!\n\n` +
                  `🌐 Server: ${health.details.url}\n` +
                  `📡 Reachable: ${health.details.reachable ? '✅ Yes' : '❌ No'}\n` +
                  `🔐 Authenticated: ${health.details.authenticated ? '✅ Yes' : '❌ No'}\n` +
                  `⏱️ Response Time: ${health.details.responseTime}ms\n\n` +
                  `❗ Problem: ${health.message}\n` +
                  `${health.details.error ? `\n🔍 Details:\n${health.details.error}\n` : ''}` +
                  `\n💡 Troubleshooting:\n` +
                  `${!health.details.reachable ? 
                    `• Server not reachable - check URL and network\n` +
                    `• Is the Komodo server running?\n` +
                    `• Check firewall settings\n` : ''}` +
                  `${health.details.reachable && !health.details.authenticated ? 
                    `• Authentication failed\n` +
                    `• Please login again with 'komodo_configure'\n` +
                    `• Check username and password\n` : ''}`
          }]
        };
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `❌ Health check error!\n\n` +
                `Unexpected error during health check:\n` +
                `${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  }

  private async handleListContainers(args: any) {
    const schema = z.object({
      server: z.string()
    });

    const { server } = schema.parse(args);
    const containers = await this.komodoClient!.listDockerContainers(server);

    return {
      content: [{
        type: 'text',
        text: `📦 Containers on server "${server}":\n\n${containers.map((c: KomodoContainer) => 
          `• ${c.name} (${c.state}) - ${c.image || 'Unknown Image'}`
        ).join('\n') || 'No containers found.'}`
      }]
    };
  }

  private async handleStartContainer(args: any) {
    const schema = z.object({
      server: z.string(),
      container: z.string()
    });

    const { server, container } = schema.parse(args);
    const result = await this.komodoClient!.startContainer(server, container);

    return {
      content: [{
        type: 'text',
        text: `🚀 Container "${container}" started on server "${server}".\n\nUpdate ID: ${result.id}`
      }]
    };
  }

  private async handleStopContainer(args: any) {
    const schema = z.object({
      server: z.string(),
      container: z.string()
    });

    const { server, container } = schema.parse(args);
    const result = await this.komodoClient!.stopContainer(server, container);

    return {
      content: [{
        type: 'text',
        text: `⏹️ Container "${container}" stopped on server "${server}".\n\nUpdate ID: ${result.id}`
      }]
    };
  }

  private async handleRestartContainer(args: any) {
    const schema = z.object({
      server: z.string(),
      container: z.string()
    });

    const { server, container } = schema.parse(args);
    const result = await this.komodoClient!.restartContainer(server, container);

    return {
      content: [{
        type: 'text',
        text: `🔄 Container "${container}" restarted on server "${server}".\n\nUpdate ID: ${result.id}`
      }]
    };
  }

  private async handlePauseContainer(args: any) {
    const schema = z.object({
      server: z.string(),
      container: z.string()
    });

    const { server, container } = schema.parse(args);
    const result = await this.komodoClient!.pauseContainer(server, container);

    return {
      content: [{
        type: 'text',
        text: `⏸️ Container "${container}" paused on server "${server}".\n\nUpdate ID: ${result.id}`
      }]
    };
  }

  private async handleUnpauseContainer(args: any) {
    const schema = z.object({
      server: z.string(),
      container: z.string()
    });

    const { server, container } = schema.parse(args);
    const result = await this.komodoClient!.unpauseContainer(server, container);

    return {
      content: [{
        type: 'text',
        text: `▶️ Container "${container}" resumed on server "${server}".\n\nUpdate ID: ${result.id}`
      }]
    };
  }

  private async handleListServers(args: any) {
    const servers = await this.komodoClient!.listServers();

    return {
      content: [{
        type: 'text',
        text: `🖥️ Available servers:\n\n${servers.map((s: KomodoServer) => 
          `• ${s.name} (${s.id}) - Status: ${s.state || 'Unknown'}`
        ).join('\n') || 'No servers found.'}`
      }]
    };
  }

  private async handleGetServerStats(args: any) {
    const schema = z.object({
      server: z.string()
    });

    const { server } = schema.parse(args);
    const stats = await this.komodoClient!.getServerState(server);

    return {
      content: [{
        type: 'text',
        text: `📊 Server "${server}" status:\n\n` +
              `• Status: ${stats.state}\n` +
              `• Version: ${stats.version || 'Unknown'}\n` +
              `• Last update: ${new Date(stats.ts).toLocaleString()}`
      }]
    };
  }

  private async handleListDeployments(args: any) {
    const deployments = await this.komodoClient!.listDeployments();

    return {
      content: [{
        type: 'text',
        text: `🚢 Deployments:\n\n${deployments.map((d: KomodoDeployment) => 
          `• ${d.name} (${d.id}) - State: ${d.state || 'Unknown'}`
        ).join('\n') || 'No deployments found.'}`
      }]
    };
  }

  private async handleDeployContainer(args: any) {
    const schema = z.object({
      deployment: z.string()
    });

    const { deployment } = schema.parse(args);
    const result = await this.komodoClient!.deployContainer(deployment);

    return {
      content: [{
        type: 'text',
        text: `🚀 Deployment "${deployment}" started.\n\nUpdate ID: ${result.id}`
      }]
    };
  }

  private async handleListStacks(args: any) {
    const stacks = await this.komodoClient!.listStacks();

    return {
      content: [{
        type: 'text',
        text: `📚 Docker Compose stacks:\n\n${stacks.map((s: KomodoStack) => 
          `• ${s.name} (${s.id}) - State: ${s.state || 'Unknown'}`
        ).join('\n') || 'No stacks found.'}`
      }]
    };
  }

  private async handleDeployStack(args: any) {
    const schema = z.object({
      stack: z.string()
    });

    const { stack } = schema.parse(args);
    const result = await this.komodoClient!.deployStack(stack);

    return {
      content: [{
        type: 'text',
        text: `🚀 Stack "${stack}" deployed.\n\nUpdate ID: ${result.id}`
      }]
    };
  }

  private async handleStopStack(args: any) {
    const schema = z.object({
      stack: z.string()
    });

    const { stack } = schema.parse(args);
    const result = await this.komodoClient!.stopStack(stack);

    return {
      content: [{
        type: 'text',
        text: `⏹️ Stack "${stack}" stopped.\n\nUpdate ID: ${result.id}`
      }]
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Komodo MCP server started');
  }
}

// Start the server
const server = new KomodoMCPServer();
server.run().catch(console.error);