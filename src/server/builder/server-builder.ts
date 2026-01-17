/**
 * MCP Server Builder
 *
 * Provides a fluent, declarative API for constructing MCP servers.
 * This is the main entry point for the framework's server creation pattern.
 *
 * @module server/builder/server-builder
 */

import { McpServer, ResourceTemplate as SdkResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

import type { IApiClient } from '../types/client.js';
import type { IServerOptions, IServerInstance, TransportMode } from '../types/server-options.js';
import type { ServerState } from '../types/lifecycle.js';
import type { ConnectionState } from '../connection/core/types.js';
import { DEFAULT_CAPABILITIES } from '../types/server-options.js';
import { DEFAULT_SHUTDOWN_CONFIG } from '../types/lifecycle.js';

import type {
  IServerBuilder,
  IBuilderState,
  IToolProvider,
  IToolDefinition,
  IResourceProvider,
  IResourceDefinition,
  IResourceTemplateDefinition,
  IPromptProvider,
  IPromptDefinition,
} from './types.js';
import { createBuilderState } from './types.js';
import { BuilderMessages, BuilderLogMessages, BUILDER_LOG_COMPONENT } from './constants.js';

import { ConnectionStateManager } from '../connection/connection-state.js';
import { RequestManager } from '../connection/request-manager.js';
import { startHttpServer } from '../transport/index.js';
import { Logger, logger as frameworkLogger, mcpLogger } from '../logger/index.js';
import { initializeTelemetry, shutdownTelemetry } from '../telemetry/index.js';
import { JsonRpcErrorCode } from '../errors/index.js';
import { setupPingHandler, setupCancellationHandler } from '../handlers/index.js';

const logger = frameworkLogger.child({ component: BUILDER_LOG_COMPONENT });

// ============================================================================
// Server Instance Implementation
// ============================================================================

/**
 * Internal server instance implementation.
 *
 * Manages the MCP server lifecycle including:
 * - Transport selection (stdio/http)
 * - Tool/Resource/Prompt registration with SDK
 * - Signal handling
 * - Graceful shutdown
 *
 * @internal
 */
class McpServerInstance<TClient extends IApiClient = IApiClient> implements IServerInstance {
  private serverState: ServerState = 'created';
  private shutdownInProgress = false;
  private mcpServers: Set<McpServer> = new Set();

  // Connection management (typed for the specific client)
  private readonly connectionManager: ConnectionStateManager<TClient>;
  private readonly requestManager: RequestManager;

  // Track whether we're using an external connection manager
  private readonly usingExternalConnectionManager: boolean;

  // Track whether we're connected for tool availability
  private isClientConnected = false;

  constructor(
    private readonly options: IServerOptions<TClient>,
    private readonly tools: IToolDefinition<unknown, TClient>[],
    private readonly resources: IResourceDefinition[],
    private readonly resourceTemplates: IResourceTemplateDefinition[],
    private readonly prompts: IPromptDefinition[],
    private readonly toolProviders: IToolProvider<TClient>[],
  ) {
    // Use external connection manager if provided, otherwise create internal one
    this.usingExternalConnectionManager = !!options.connectionManager;
    this.connectionManager = options.connectionManager ?? new ConnectionStateManager<TClient>();
    this.requestManager = new RequestManager();

    // Setup connection state listener for tool availability
    this.connectionManager.onStateChange((state: ConnectionState, _client: TClient | null) => {
      const wasConnected = this.isClientConnected;
      this.isClientConnected = state === 'connected';

      // Update tool providers with connection state
      for (const provider of this.toolProviders) {
        provider.setConnectionState(this.isClientConnected);
      }

      // Notify MCP servers of tool list change
      if (this.isClientConnected !== wasConnected) {
        for (const server of this.mcpServers) {
          server.server.sendToolListChanged().catch((err: Error) => {
            logger.warn('Failed to send tool list changed notification: %s', err.message);
          });
        }

        const availableCount = this.getAvailableToolCount();
        logger.info(BuilderLogMessages.TOOLS_AVAILABLE, availableCount);
      }
    });

    // If using external connection manager, sync initial state
    if (this.usingExternalConnectionManager) {
      this.isClientConnected = this.connectionManager.getState() === 'connected';
      for (const provider of this.toolProviders) {
        provider.setConnectionState(this.isClientConnected);
      }
      logger.debug(
        'Using external connection manager (state: %s, client: %s)',
        this.connectionManager.getState(),
        this.connectionManager.getClient() ? 'available' : 'null',
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // IServerInstance Implementation
  // ─────────────────────────────────────────────────────────────────────────

  get name(): string {
    return this.options.name;
  }

  get version(): string {
    return this.options.version;
  }

  get isRunning(): boolean {
    return this.serverState === 'running';
  }

  /**
   * Notify all connected MCP clients that the tool list has changed.
   *
   * Call this when external connection state changes affect tool availability.
   * This is useful when using an external connection manager (like komodoConnectionManager)
   * instead of the builder's internal connection management.
   */
  notifyToolListChanged(): void {
    for (const server of this.mcpServers) {
      server.server.sendToolListChanged().catch((err: Error) => {
        logger.warn('Failed to send tool list changed notification: %s', err.message);
      });
    }
    if (this.mcpServers.size > 0) {
      logger.debug('Sent tool list changed notification to %d server(s)', this.mcpServers.size);
    }
  }

  async start(): Promise<void> {
    if (this.serverState === 'running') {
      logger.warn(BuilderMessages.SERVER_ALREADY_RUNNING);
      return;
    }

    this.serverState = 'starting';
    logger.info(BuilderLogMessages.SERVER_STARTING);

    // Call lifecycle hook
    await this.options.lifecycle?.onStarting?.();

    // Initialize telemetry if enabled
    if (this.options.telemetryEnabled) {
      initializeTelemetry();
    }

    // Select transport and start
    const transportMode = this.resolveTransportMode();

    if (transportMode === 'http') {
      await this.startHttpMode();
    } else {
      await this.startStdioMode();
    }

    this.serverState = 'running';

    // Try to auto-connect client
    if (this.options.autoConnect !== false && this.options.clientFactory) {
      try {
        const client = await this.options.clientFactory();
        await this.connectionManager.connect(client);
      } catch (error) {
        logger.warn('Auto-connect failed: %s', error instanceof Error ? error.message : String(error));
      }
    }

    // Call lifecycle hook
    await this.options.lifecycle?.onStarted?.();

    logger.info(BuilderLogMessages.SERVER_STARTED, this.options.name, this.options.version, transportMode);
  }

  async stop(): Promise<void> {
    if (this.shutdownInProgress) {
      logger.debug('Shutdown already in progress');
      return;
    }

    this.shutdownInProgress = true;
    this.serverState = 'stopping';
    logger.info(BuilderLogMessages.SERVER_STOPPING);

    // Call lifecycle hook
    await this.options.lifecycle?.onStopping?.();

    // Close log streams
    await Logger.closeStreams();

    // Shutdown telemetry
    if (this.options.telemetryEnabled) {
      await shutdownTelemetry();
    }

    this.serverState = 'stopped';

    // Call lifecycle hook
    await this.options.lifecycle?.onStopped?.();

    logger.info(BuilderLogMessages.SERVER_STOPPED);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Transport Initialization
  // ─────────────────────────────────────────────────────────────────────────

  private resolveTransportMode(): TransportMode {
    const mode = this.options.transport?.mode ?? 'auto';

    if (mode === 'auto') {
      // Auto-detect based on environment
      const envTransport = process.env.MCP_TRANSPORT?.toLowerCase();
      if (envTransport === 'http' || envTransport === 'sse') {
        return 'http';
      }
      return 'stdio';
    }

    return mode;
  }

  private async startStdioMode(): Promise<void> {
    const server = this.createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);

    // Simple shutdown for stdio mode
    this.setupSignalHandlers(() => this.stop());
  }

  private async startHttpMode(): Promise<void> {
    const { server, sessionManager } = startHttpServer(() => this.createMcpServer(), {
      port: this.options.transport?.http?.port,
    });

    // HTTP-specific shutdown
    const shutdown = async () => {
      await this.stop();
      await sessionManager.closeAll();
      server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
      });

      // Force exit after timeout
      const timeout = this.options.shutdown?.timeoutMs ?? DEFAULT_SHUTDOWN_CONFIG.timeoutMs;
      setTimeout(() => {
        logger.error(BuilderMessages.SHUTDOWN_FORCED);
        process.exit(1);
      }, timeout).unref();
    };

    this.setupSignalHandlers(shutdown);
  }

  private setupSignalHandlers(handler: () => Promise<void>): void {
    const signals = this.options.shutdown?.signals ?? DEFAULT_SHUTDOWN_CONFIG.signals ?? ['SIGINT', 'SIGTERM'];

    for (const signal of signals) {
      process.on(signal, () => {
        logger.info(BuilderLogMessages.SHUTDOWN_SIGNAL, signal);
        handler();
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MCP Server Creation
  // ─────────────────────────────────────────────────────────────────────────

  private createMcpServer(): McpServer {
    // Build capabilities
    const capabilities = this.buildCapabilities();

    // Create SDK server instance
    const server = new McpServer({ name: this.options.name, version: this.options.version }, { capabilities });

    // Track this server
    this.mcpServers.add(server);

    // Register server with MCP logger for client notifications
    mcpLogger.addServer(server);

    // Setup handlers
    setupPingHandler(server);
    setupCancellationHandler(server);

    // Initialize request manager with McpServer instance
    this.requestManager.setServer(server);

    // Register all MCP primitives
    this.registerToolsWithServer(server);
    this.registerResourcesWithServer(server);
    this.registerPromptsWithServer(server);

    // Clean up when server closes
    server.server.onclose = () => {
      this.mcpServers.delete(server);
      mcpLogger.removeServer(server);
      logger.debug('MCP server closed, %d active servers remaining', this.mcpServers.size);
    };

    server.server.onerror = (error: Error) => {
      logger.error('MCP Error:', error);
    };

    return server;
  }

  private buildCapabilities(): Record<string, unknown> {
    const caps = this.options.capabilities ?? DEFAULT_CAPABILITIES;
    const result: Record<string, unknown> = {};

    // Logging capability
    if (caps.logging) {
      result.logging = {};
    }

    // Tools capability
    const allTools = this.getAllTools();
    if (caps.tools && allTools.length > 0) {
      result.tools = typeof caps.tools === 'object' ? caps.tools : { listChanged: true };
    }

    // Resources capability
    if (caps.resources && (this.resources.length > 0 || this.resourceTemplates.length > 0)) {
      result.resources = typeof caps.resources === 'object' ? caps.resources : { listChanged: true };
    }

    // Prompts capability
    if (caps.prompts && this.prompts.length > 0) {
      result.prompts = typeof caps.prompts === 'object' ? caps.prompts : { listChanged: true };
    }

    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Tool Registration
  // ─────────────────────────────────────────────────────────────────────────

  private registerToolsWithServer(server: McpServer): void {
    const allTools = this.getAllTools();

    if (allTools.length === 0) {
      logger.debug('No tools to register');
      return;
    }

    logger.info(BuilderLogMessages.TOOLS_REGISTERED, allTools.length);

    for (const tool of allTools) {
      const requiresClient = tool.requiresClient !== false;

      // Use registerTool API (same as existing implementation)
      server.registerTool(
        tool.name,
        {
          description: tool.description,
          inputSchema: tool.schema,
        },
        async (args: unknown, _extra) => {
          // Check tool availability
          if (requiresClient && !this.isClientConnected) {
            throw new McpError(ErrorCode.InvalidRequest, BuilderMessages.TOOL_UNAVAILABLE(tool.name));
          }

          // Generate request ID for tracking
          const internalRequestId = Math.random().toString(36).substring(7);

          // Extract progress token from _meta if provided
          const argsWithMeta = args as { _meta?: { progressToken?: string | number } };
          const progressToken = argsWithMeta._meta?.progressToken;

          // Register request for cancellation tracking
          const abortSignal = this.requestManager.registerRequest(
            internalRequestId,
            `tools/call:${tool.name}`,
            progressToken,
          );

          // Create progress reporter
          const reportProgress = this.requestManager.createProgressReporter(progressToken);

          try {
            // Check for pre-cancellation
            if (abortSignal.aborted) {
              throw new McpError(JsonRpcErrorCode.REQUEST_CANCELLED, 'Request was cancelled before execution');
            }

            logger.info('Tool [%s] executing', tool.name);

            const result = await tool.handler(args as Parameters<typeof tool.handler>[0], {
              client: this.connectionManager.getClient(),
              setClient: async (client: TClient) => {
                await this.connectionManager.connect(client);
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
            this.requestManager.unregisterRequest(internalRequestId);
          }
        },
      );

      logger.debug(BuilderLogMessages.TOOL_REGISTERED, tool.name, requiresClient);
    }
  }

  private getAllTools(): IToolDefinition<unknown, TClient>[] {
    const allTools: IToolDefinition<unknown, TClient>[] = [...this.tools];

    for (const provider of this.toolProviders) {
      allTools.push(...provider.getTools());
    }

    return allTools;
  }

  private getAvailableToolCount(): number {
    let count = 0;

    // Count direct tools
    for (const tool of this.tools) {
      if (tool.requiresClient === false || this.isClientConnected) {
        count++;
      }
    }

    // Count from providers
    for (const provider of this.toolProviders) {
      count += provider.getAvailableTools().length;
    }

    return count;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Resource Registration
  // ─────────────────────────────────────────────────────────────────────────

  private registerResourcesWithServer(server: McpServer): void {
    if (this.resources.length === 0 && this.resourceTemplates.length === 0) {
      logger.debug('No resources to register');
      return;
    }

    logger.info(BuilderLogMessages.RESOURCES_REGISTERED, this.resources.length, this.resourceTemplates.length);

    // Register static resources
    for (const resource of this.resources) {
      server.registerResource(
        resource.name,
        resource.uri,
        { description: resource.description, mimeType: resource.mimeType },
        async () => {
          logger.debug('Reading resource: %s', resource.uri);
          const contents = await resource.handler();
          return {
            contents: contents.map((c) => {
              if ('text' in c && c.text !== undefined) {
                return { uri: c.uri, mimeType: c.mimeType, text: c.text };
              } else if ('blob' in c && c.blob !== undefined) {
                return { uri: c.uri, mimeType: c.mimeType, blob: c.blob };
              }
              return { uri: c.uri, mimeType: c.mimeType, text: '' };
            }),
          };
        },
      );
      logger.debug(BuilderLogMessages.RESOURCE_REGISTERED, resource.name, resource.uri);
    }

    // Register templates
    for (const template of this.resourceTemplates) {
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
      });

      server.registerResource(
        template.name,
        sdkTemplate,
        { description: template.description, mimeType: template.mimeType },
        async (_uri: URL, variables: Record<string, string | string[]>) => {
          logger.debug('Reading resource template: %s with variables %j', template.uriTemplate, variables);

          if (template.argumentsSchema) {
            template.argumentsSchema.parse(variables);
          }

          const contents = await template.handler(variables as Parameters<typeof template.handler>[0]);
          return {
            contents: contents.map((c) => {
              if ('text' in c && c.text !== undefined) {
                return { uri: c.uri, mimeType: c.mimeType, text: c.text };
              } else if ('blob' in c && c.blob !== undefined) {
                return { uri: c.uri, mimeType: c.mimeType, blob: c.blob };
              }
              return { uri: c.uri, mimeType: c.mimeType, text: '' };
            }),
          };
        },
      );
      logger.debug(BuilderLogMessages.TEMPLATE_REGISTERED, template.name, template.uriTemplate);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Prompt Registration
  // ─────────────────────────────────────────────────────────────────────────

  private registerPromptsWithServer(server: McpServer): void {
    if (this.prompts.length === 0) {
      logger.debug('No prompts to register');
      return;
    }

    logger.info(BuilderLogMessages.PROMPTS_REGISTERED, this.prompts.length);

    for (const prompt of this.prompts) {
      server.registerPrompt(prompt.name, { description: prompt.description }, async (args: Record<string, string>) => {
        logger.debug('Getting prompt: %s with args %j', prompt.name, args);
        const result = await prompt.handler(args);
        return {
          description: result.description,
          messages: result.messages.map((m) => ({
            role: m.role,
            content: { type: 'text' as const, text: m.content },
          })),
        };
      });
      logger.debug(BuilderLogMessages.PROMPT_REGISTERED, prompt.name);
    }
  }
}

// ============================================================================
// Server Builder Implementation
// ============================================================================

/**
 * Fluent builder for constructing MCP servers.
 *
 * Provides a declarative API for configuring all aspects of an MCP server
 * including tools, resources, prompts, transport, and lifecycle hooks.
 *
 * @typeParam TClient - The API client type (extends IApiClient)
 *
 * @example Basic usage with tool provider
 * ```typescript
 * const server = new McpServerBuilder<MyClient>()
 *   .withOptions({
 *     name: 'my-mcp-server',
 *     version: '1.0.0',
 *     transport: { mode: 'stdio' },
 *   })
 *   .withToolProvider(myToolRegistry)
 *   .build();
 *
 * await server.start();
 * ```
 */
export class McpServerBuilder<TClient extends IApiClient = IApiClient> implements IServerBuilder<TClient> {
  private state: IBuilderState<TClient>;

  constructor() {
    this.state = createBuilderState<TClient>();
  }

  withOptions(options: IServerOptions<TClient>): IServerBuilder<TClient> {
    if (this.state.options) {
      logger.warn(BuilderMessages.OPTIONS_ALREADY_SET);
    }
    this.state.options = options;
    logger.debug(BuilderLogMessages.OPTIONS_CONFIGURED, options.name, options.version);
    return this;
  }

  withToolProvider(provider: IToolProvider<TClient>): IServerBuilder<TClient> {
    this.state.toolProviders.push(provider);
    return this;
  }

  withTools(tools: ReadonlyArray<IToolDefinition<unknown, TClient>>): IServerBuilder<TClient> {
    this.state.tools.push(...tools);
    return this;
  }

  withResourceProvider(provider: IResourceProvider): IServerBuilder<TClient> {
    this.state.resourceProviders.push(provider);
    return this;
  }

  withResources(resources: ReadonlyArray<IResourceDefinition>): IServerBuilder<TClient> {
    this.state.resources.push(...resources);
    return this;
  }

  withResourceTemplates(templates: ReadonlyArray<IResourceTemplateDefinition>): IServerBuilder<TClient> {
    this.state.resourceTemplates.push(...templates);
    return this;
  }

  withPromptProvider(provider: IPromptProvider): IServerBuilder<TClient> {
    this.state.promptProviders.push(provider);
    return this;
  }

  withPrompts(prompts: ReadonlyArray<IPromptDefinition>): IServerBuilder<TClient> {
    this.state.prompts.push(...prompts);
    return this;
  }

  build(): IServerInstance {
    logger.info(BuilderLogMessages.BUILD_STARTED);

    // Validate options
    if (!this.state.options) {
      throw new Error(BuilderMessages.OPTIONS_REQUIRED);
    }
    if (!this.state.options.name) {
      throw new Error(BuilderMessages.NAME_REQUIRED);
    }
    if (!this.state.options.version) {
      throw new Error(BuilderMessages.VERSION_REQUIRED);
    }

    // Collect all tools (from providers and direct registration)
    const allTools: IToolDefinition<unknown, TClient>[] = [...this.state.tools];
    for (const provider of this.state.toolProviders) {
      allTools.push(...provider.getTools());
    }

    // Collect all resources
    const allResources: IResourceDefinition[] = [...this.state.resources];
    const allTemplates: IResourceTemplateDefinition[] = [...this.state.resourceTemplates];
    for (const provider of this.state.resourceProviders) {
      allResources.push(...(provider.getResources() as IResourceDefinition[]));
      allTemplates.push(...(provider.getTemplates() as IResourceTemplateDefinition[]));
    }

    // Collect all prompts
    const allPrompts: IPromptDefinition[] = [...this.state.prompts];
    for (const provider of this.state.promptProviders) {
      allPrompts.push(...(provider.getPrompts() as IPromptDefinition[]));
    }

    // Create server instance
    const instance = new McpServerInstance<TClient>(
      this.state.options,
      this.state.tools,
      allResources,
      allTemplates,
      allPrompts,
      this.state.toolProviders,
    );

    logger.info(
      BuilderLogMessages.BUILD_SUMMARY,
      allTools.length,
      allResources.length + allTemplates.length,
      allPrompts.length,
    );
    logger.info(BuilderLogMessages.BUILD_COMPLETED);

    return instance;
  }
}
