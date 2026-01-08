#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ErrorCode, McpError, CancelledNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { KomodoClient } from './api/index.js';
import { registerTools, toolRegistry } from './tools/index.js';
import { registerResources, resourceRegistry } from './resources/index.js';
import { registerPrompts, promptRegistry } from './prompts/index.js';
import { config, SERVER_NAME, SERVER_VERSION, JsonRpcErrorCode } from './config/index.js';
import { startHttpServer } from './transport/index.js';
import { logger, LogLevel } from './utils/logger.js';
import { requestManager } from './utils/request-manager.js';

// Komodo MCP server - Container Management Server
/**
 * Main application class for the Komodo MCP Server.
 * Manages the MCP server instance, tool registration, and Komodo client state.
 */
class KomodoMCPServer {
  private komodoClient: KomodoClient | null = null;
  private shutdownInProgress = false;

  constructor() {
    // Register all tools, resources, and prompts
    registerTools();
    registerResources();
    registerPrompts();
    // Note: Signal handlers are registered in run() based on transport mode
  }

  /**
   * Maps internal log levels to MCP logging levels.
   *
   * @param level - The internal log level
   * @returns The corresponding MCP log level
   */
  private mapLogLevel(
    level: LogLevel,
  ): 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency' {
    switch (level) {
      case 'trace':
        return 'debug';
      case 'debug':
        return 'debug';
      case 'info':
        return 'info';
      case 'warn':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'info';
    }
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

    server.server.onerror = (error) => {
      logger.error('MCP Error:', error);
    };

    // Set up cancellation notification handler
    // Per MCP Spec: Handle notifications/cancelled to stop in-flight requests
    this.setupCancellationHandler(server);

    // Initialize request manager with McpServer instance for progress notifications
    requestManager.setServer(server);

    const tools = toolRegistry.getTools();
    logger.info('Registering %d tools with MCP server', tools.length);

    for (const tool of tools) {
      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: tool.schema,
        },
        async (args, _extra) => {
          // Get existing context (to preserve sessionId)
          const existingContext = logger.getContext();

          // Generate a unique request ID for tracking
          const internalRequestId = Math.random().toString(36).substring(7);

          // Extract progress token from _meta if provided
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const progressToken = (args as any)?._meta?.progressToken;

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
            sendMcpLog: (level: LogLevel, message: string) => {
              server.server
                .sendLoggingMessage({
                  level: this.mapLogLevel(level),
                  data: message,
                })
                .catch(() => {
                  // Ignore errors sending logs to client (e.g. if disconnected)
                });
            },
          };

          return logger.runWithContext(context, async () => {
            try {
              // Check if already cancelled before starting
              if (abortSignal.aborted) {
                throw new McpError(JsonRpcErrorCode.REQUEST_CANCELLED, 'Request was cancelled before execution');
              }

              logger.info('Tool [%s] executing', tool.name);

              const result = await tool.handler(args, {
                client: this.komodoClient,
                setClient: (client: KomodoClient) => {
                  this.komodoClient = client;
                },
                reportProgress,
                abortSignal,
              });

              return result;
            } catch (error) {
              // Handle cancellation
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

    // Register resource templates - skipping for now as they need special handling
    // TODO: Implement ResourceTemplate registration with proper UriTemplate class
    if (templates.length > 0) {
      logger.warn('Resource templates not yet supported, skipping %d templates', templates.length);
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
   * Sets up the cancellation notification handler.
   *
   * Per MCP Spec 2025-11-25:
   * - Receivers SHOULD stop processing the cancelled request
   * - Receivers SHOULD free associated resources
   * - Receivers SHOULD NOT send a response for the cancelled request
   * - Invalid cancellation notifications SHOULD be ignored
   *
   * @param server - The McpServer instance
   */
  private setupCancellationHandler(server: McpServer): void {
    server.server.setNotificationHandler(CancelledNotificationSchema, async (notification) => {
      const { requestId, reason } = notification.params;

      // Per spec: requestId is required for cancellation
      if (requestId === undefined) {
        logger.debug('Cancellation ignored: no requestId provided');
        return;
      }

      logger.info('Cancellation received: requestId=%s reason=%s', requestId, reason || 'none');

      // Delegate to request manager
      const cancelled = requestManager.handleCancellation(requestId, reason);

      if (!cancelled) {
        // Per spec: Invalid cancellation notifications SHOULD be ignored
        logger.debug('Cancellation ignored: request not found or already completed');
      }
    });

    logger.debug('Cancellation handler registered');
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
    if (config.KOMODO_URL) {
      try {
        if (config.KOMODO_API_KEY && config.KOMODO_API_SECRET) {
          logger.info(`Attempting API Key configuration for ${config.KOMODO_URL}...`);
          this.komodoClient = KomodoClient.connectWithApiKey(
            config.KOMODO_URL,
            config.KOMODO_API_KEY,
            config.KOMODO_API_SECRET,
          );

          // Verify connection
          const health = await this.komodoClient.healthCheck();
          if (health.status !== 'healthy') {
            throw new Error(`Health check failed: ${health.message}`);
          }
          logger.info('✅ API Key configuration successful');
        } else if (config.KOMODO_USERNAME && config.KOMODO_PASSWORD) {
          logger.info(`Attempting auto-configuration for ${config.KOMODO_URL}...`);
          this.komodoClient = await KomodoClient.login(
            config.KOMODO_URL,
            config.KOMODO_USERNAME,
            config.KOMODO_PASSWORD,
          );
          logger.info('✅ Auto-configuration successful');
        }
      } catch (error) {
        logger.warn('⚠️ Auto-configuration failed: %s', error instanceof Error ? error.message : String(error));
        this.komodoClient = null;
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
