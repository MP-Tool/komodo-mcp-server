#!/usr/bin/env node

/**
 * Komodo MCP Server - Main Entry Point
 *
 * Model Context Protocol server for managing Docker containers,
 * deployments, and stacks through Komodo.
 *
 * @module index
 */

import { McpServer, ResourceTemplate as SdkResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';

// Internal modules - use barrel imports
import { KomodoClient } from './api/index.js';
import { registerTools, toolRegistry } from './tools/index.js';
import { registerResources, resourceRegistry } from './resources/index.js';
import { registerPrompts, promptRegistry } from './prompts/index.js';
import { config, SERVER_NAME, SERVER_VERSION, JsonRpcErrorCode } from './config/index.js';
import { startHttpServer } from './transport/index.js';
import { logger, Logger, requestManager, connectionManager, mcpLogger } from './utils/index.js';
import { setupCancellationHandler, setupPingHandler, initializeClientFromEnv } from './server/index.js';

/**
 * Main application class for the Komodo MCP Server.
 * Manages the MCP server instance, tool registration, and Komodo client state.
 */
class KomodoMCPServer {
  private shutdownInProgress = false;
  /** Active MCP server instances for sending notifications */
  private mcpServers: Set<McpServer> = new Set();

  constructor() {
    // Register all tools, resources, and prompts
    registerTools();
    registerResources();
    registerPrompts();

    // Set up connection state listener to update tool availability
    connectionManager.onStateChange((state, client) => {
      const wasConnected = toolRegistry.getConnectionState();
      const isConnected = state === 'connected' && client !== null;

      if (toolRegistry.setConnectionState(isConnected)) {
        // State changed - notify all active MCP servers
        logger.info('Tool availability changed: %s tools now available', toolRegistry.getAvailableTools().length);

        for (const server of this.mcpServers) {
          try {
            server.sendToolListChanged();
            logger.debug('Sent tools/list_changed notification');
          } catch (error) {
            logger.error('Failed to send tool list changed notification:', error);
          }
        }
      }

      // Log connection state changes
      if (!wasConnected && isConnected) {
        logger.info('Komodo connected - %d tools now available', toolRegistry.getAvailableTools().length);
      } else if (wasConnected && !isConnected) {
        logger.info('Komodo disconnected - %d tools now available', toolRegistry.getAvailableTools().length);
      }
    });

    // Note: Signal handlers are registered in run() based on transport mode
  }

  /**
   * Creates and configures the MCP server instance.
   * Registers all tools, sets up logging, and configures notification handlers.
   *
   * Capabilities advertised dynamically based on registered items:
   * - tools: Auto-registered via registerTool() calls
   * - logging: Always enabled for structured log messages
   * - resources: Only if resourceRegistry has items (for Komodo documentation)
   * - prompts: Only if promptRegistry has items (for workflow templates)
   *
   * @returns The configured McpServer instance
   */
  private createMcpServer(): McpServer {
    // Build capabilities dynamically based on what's registered
    const capabilities: Record<string, object> = {
      // Logging is always available
      logging: {},
      // Tools with dynamic availability (listChanged support)
      tools: { listChanged: true },
    };

    // Only advertise resources capability if we have resources registered
    if (resourceRegistry.hasResources()) {
      capabilities.resources = { listChanged: true };
      logger.debug(
        'Resources capability enabled (%d resources, %d templates)',
        resourceRegistry.getCount().resources,
        resourceRegistry.getCount().templates,
      );
    }

    // Only advertise prompts capability if we have prompts registered
    if (promptRegistry.hasPrompts()) {
      capabilities.prompts = { listChanged: true };
      logger.debug('Prompts capability enabled (%d prompts)', promptRegistry.getCount());
    }

    const server = new McpServer(
      {
        name: SERVER_NAME,
        version: SERVER_VERSION,
      },
      { capabilities },
    );

    // Track this server for tool list change notifications
    this.mcpServers.add(server);

    // Register server with MCP logger for client notifications
    mcpLogger.addServer(server);

    // Clean up when server closes
    server.server.onclose = () => {
      this.mcpServers.delete(server);
      mcpLogger.removeServer(server);
      logger.debug('MCP server closed, %d active servers remaining', this.mcpServers.size);
    };

    server.server.onerror = (error) => {
      logger.error('MCP Error:', error);
    };

    // Set up cancellation notification handler
    // Per MCP Spec: Handle notifications/cancelled to stop in-flight requests
    setupCancellationHandler(server);

    // Set up ping handler for liveness checks
    setupPingHandler(server);

    // Initialize request manager with McpServer instance for progress notifications
    requestManager.setServer(server);

    const tools = toolRegistry.getTools();
    logger.info(
      'Registering %d tools with MCP server (%d available)',
      tools.length,
      toolRegistry.getAvailableTools().length,
    );

    for (const tool of tools) {
      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: tool.schema,
        },
        async (args, _extra) => {
          // Check if tool is currently available (connection-dependent tools require connection)
          if (!toolRegistry.getTool(tool.name)) {
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Tool '${tool.name}' requires a Komodo connection. Use 'komodo_configure' to connect first.`,
            );
          }

          // Get existing context (to preserve sessionId)
          const existingContext = logger.getContext();

          // Generate a unique request ID for tracking
          const internalRequestId = Math.random().toString(36).substring(7);

          // Extract progress token from _meta if provided
          // MCP Spec allows progressToken in _meta for progress notifications
          const argsWithMeta = args as { _meta?: { progressToken?: string | number } };
          const progressToken = argsWithMeta._meta?.progressToken;

          // Register request for cancellation tracking
          const abortSignal = requestManager.registerRequest(
            internalRequestId,
            `tools/call:${tool.name}`,
            progressToken,
          );

          // Create progress reporter if token provided
          const reportProgress = requestManager.createProgressReporter(progressToken);

          // Create a context for this execution
          const context = {
            sessionId: existingContext?.sessionId,
            requestId: internalRequestId,
            sendMcpLog: mcpLogger.createContextLogger(server),
          };

          return logger.runWithContext(context, async () => {
            try {
              // Check if already cancelled before starting
              if (abortSignal.aborted) {
                throw new McpError(JsonRpcErrorCode.REQUEST_CANCELLED, 'Request was cancelled before execution');
              }

              logger.info('Tool [%s] executing', tool.name);

              const result = await tool.handler(args, {
                client: connectionManager.getClient(),
                setClient: async (client: KomodoClient) => {
                  // Use connectionManager to set client and update tool availability
                  await connectionManager.connect(client);
                },
                reportProgress,
                abortSignal,
              });

              return result;
            } catch (error) {
              // Handle cancellation
              // Note: MCP Spec says "SHOULD NOT send a response" for cancelled requests,
              // but the SDK architecture requires throwing an error to stop processing.
              // We use REQUEST_CANCELLED (-32800) to clearly indicate cancellation to the client.
              // This is a pragmatic trade-off for SDK compatibility.
              if (abortSignal.aborted || (error instanceof Error && error.name === 'AbortError')) {
                logger.info('Tool [%s] cancelled', tool.name);
                throw new McpError(JsonRpcErrorCode.REQUEST_CANCELLED, 'Request was cancelled');
              }

              logger.error(`Error executing ${tool.name}:`, error);
              if (error instanceof McpError) {
                throw error;
              }
              throw new McpError(
                ErrorCode.InternalError,
                `Error executing ${tool.name}: ${error instanceof Error ? error.message : String(error)}`,
              );
            } finally {
              // Always unregister the request when done
              requestManager.unregisterRequest(internalRequestId);
            }
          });
        },
      );
    }

    // Register resources with McpServer
    this.registerResourcesWithServer(server);

    // Register prompts with McpServer
    this.registerPromptsWithServer(server);

    return server;
  }

  /**
   * Registers all resources from the registry with the McpServer.
   * This enables clients to list and read resources via the MCP protocol.
   *
   * @param server - The McpServer instance
   */
  private registerResourcesWithServer(server: McpServer): void {
    const resources = resourceRegistry.getResources();
    const templates = resourceRegistry.getTemplates();

    if (resources.length === 0 && templates.length === 0) {
      logger.debug('No resources to register');
      return;
    }

    logger.info('Registering %d resources and %d templates with MCP server', resources.length, templates.length);

    // Register static resources
    for (const resource of resources) {
      server.registerResource(
        resource.name,
        resource.uri,
        {
          description: resource.description,
          mimeType: resource.mimeType,
        },
        async (_uri: URL) => {
          logger.debug('Reading resource: %s', resource.uri);
          const contents = await resource.handler();
          // McpServer expects { contents: [...] } with either text OR blob
          return {
            contents: contents.map((c) => {
              if ('text' in c && c.text !== undefined) {
                return { uri: c.uri, mimeType: c.mimeType, text: c.text };
              } else if ('blob' in c && c.blob !== undefined) {
                return { uri: c.uri, mimeType: c.mimeType, blob: c.blob };
              }
              // Default to empty text if neither is provided
              return { uri: c.uri, mimeType: c.mimeType, text: '' };
            }),
          };
        },
      );
      logger.debug('Registered resource: %s (%s)', resource.name, resource.uri);
    }

    // Register resource templates (RFC 6570 URI Templates)
    // The SDK's ResourceTemplate class wraps UriTemplate and handles variable extraction
    for (const template of templates) {
      // Create SDK ResourceTemplate instance with list callback if provided
      // The list callback returns available resources matching this template
      const sdkTemplate = new SdkResourceTemplate(template.uriTemplate, {
        list: template.list
          ? async () => {
              try {
                const items = await template.list!();
                return {
                  resources: items.map((item) => ({
                    uri: item.uri,
                    name: item.name ?? template.name,
                    description: item.description ?? template.description,
                    mimeType: item.mimeType ?? template.mimeType,
                  })),
                };
              } catch (error) {
                logger.error('Failed to list resources for template %s: %s', template.uriTemplate, error);
                return { resources: [] };
              }
            }
          : undefined,
        // complete: {} // Optional: Add completion callbacks for variables
      });

      server.registerResource(
        template.name,
        sdkTemplate,
        {
          description: template.description,
          mimeType: template.mimeType,
        },
        async (uri: URL, variables: Record<string, string | string[]>) => {
          logger.debug('Reading resource template: %s with variables %j', template.uriTemplate, variables);

          // Validate arguments if schema is provided
          if (template.argumentsSchema) {
            try {
              template.argumentsSchema.parse(variables);
            } catch (error) {
              logger.error('Resource template argument validation failed: %s', error);
              throw new McpError(
                ErrorCode.InvalidParams,
                `Invalid arguments for resource template: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          }

          const contents = await template.handler(variables);
          // McpServer expects { contents: [...] } with either text OR blob
          return {
            contents: contents.map((c) => {
              if ('text' in c && c.text !== undefined) {
                return { uri: c.uri, mimeType: c.mimeType, text: c.text };
              } else if ('blob' in c && c.blob !== undefined) {
                return { uri: c.uri, mimeType: c.mimeType, blob: c.blob };
              }
              // Default to empty text if neither is provided
              return { uri: c.uri, mimeType: c.mimeType, text: '' };
            }),
          };
        },
      );
      logger.debug('Registered resource template: %s (%s)', template.name, template.uriTemplate);
    }
  }

  /**
   * Registers all prompts from the registry with the McpServer.
   * This enables clients to list and get prompts via the MCP protocol.
   *
   * @param server - The McpServer instance
   */
  private registerPromptsWithServer(server: McpServer): void {
    const prompts = promptRegistry.getPrompts();

    if (prompts.length === 0) {
      logger.debug('No prompts to register');
      return;
    }

    logger.info('Registering %d prompts with MCP server', prompts.length);

    for (const prompt of prompts) {
      server.registerPrompt(
        prompt.name,
        {
          description: prompt.description,
          // Note: Not passing argsSchema - McpServer will accept any arguments
          // Our prompts define arguments descriptively but not as Zod schemas
        },
        async (args: Record<string, string>) => {
          logger.debug('Getting prompt: %s with args %j', prompt.name, args);
          const result = await prompt.handler(args);
          // McpServer expects { messages: [...] } with specific content format
          return {
            description: result.description,
            messages: result.messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          };
        },
      );
      logger.debug('Registered prompt: %s', prompt.name);
    }
  }

  /**
   * Starts the server using the configured transport (Stdio or HTTP/SSE).
   */
  async run(): Promise<void> {
    if (config.MCP_TRANSPORT === 'http') {
      // Pass factory function to create a new server instance per connection
      const { server, sessionManager } = startHttpServer(() => this.createMcpServer());
      logger.info(`Komodo MCP server started (HTTP Mode) on port ${config.MCP_PORT}`);

      // Graceful shutdown handler
      const shutdown = async () => {
        // Prevent multiple shutdown attempts
        if (this.shutdownInProgress) {
          logger.debug('Shutdown already in progress, ignoring signal');
          return;
        }
        this.shutdownInProgress = true;
        logger.info('Received shutdown signal, closing server...');

        // Close all active MCP sessions
        await sessionManager.closeAll();

        // Close log file streams
        await Logger.closeStreams();

        // Close HTTP server
        server.close(() => {
          logger.info('HTTP server closed');
          process.exit(0);
        });

        // Force exit if server doesn't close in 10s
        setTimeout(() => {
          logger.error('Forcing shutdown after timeout');
          process.exit(1);
        }, 10000).unref(); // unref() so it doesn't keep process alive
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    } else if (config.MCP_TRANSPORT === 'stdio') {
      const server = this.createMcpServer();
      const transport = new StdioServerTransport();
      await server.connect(transport);
      logger.info('Komodo MCP server started (Stdio Mode)');

      // Simple shutdown for stdio mode
      const shutdown = () => {
        if (this.shutdownInProgress) return;
        this.shutdownInProgress = true;
        logger.info('Received shutdown signal, exiting...');
        process.exit(0);
      };
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    } else {
      throw new Error(`Unsupported MCP_TRANSPORT: ${config.MCP_TRANSPORT}`);
    }

    // Try to initialize client from environment variables
    await initializeClientFromEnv();
  }
}

// Start the server
const server = new KomodoMCPServer();
server.run().catch((error) => {
  logger.error('Fatal error running server:', error);
  process.exit(1);
});
