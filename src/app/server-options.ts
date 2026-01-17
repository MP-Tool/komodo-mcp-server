/**
 * Komodo MCP Server Options
 *
 * Provides the Komodo-specific server configuration that builds on the framework's
 * IServerOptions interface. This is the application-specific configuration layer.
 *
 * @module app/server-options
 */

import type { KomodoClient } from './api/index.js';
import type { IServerOptions, IServerLifecycleHooks } from './framework.js';

import { config, getKomodoCredentials } from './config/index.js';
import { SERVER_NAME, SERVER_VERSION, SHUTDOWN_CONFIG } from './config/index.js';
import { KomodoClient as KomodoClientClass } from './api/index.js';
import { logger } from './framework.js';

// ============================================================================
// Komodo Lifecycle Hooks
// ============================================================================

/**
 * Creates Komodo-specific lifecycle hooks.
 *
 * @param options - Optional customizations
 * @returns Lifecycle hooks for Komodo server
 */
export function createKomodoLifecycleHooks(options?: Partial<IServerLifecycleHooks>): IServerLifecycleHooks {
  return {
    onStarting: async () => {
      logger.debug('Komodo MCP Server starting...');
      await options?.onStarting?.();
    },

    onStarted: async () => {
      logger.info('✅ Komodo MCP Server ready');
      await options?.onStarted?.();
    },

    onStopping: async () => {
      logger.info('Komodo MCP Server shutting down...');
      await options?.onStopping?.();
    },

    onStopped: async () => {
      logger.info('Komodo MCP Server stopped');
      await options?.onStopped?.();
    },

    onError: async (error) => {
      logger.error('Komodo MCP Server error:', error);
      await options?.onError?.(error);
    },

    onClientConnected: async (sessionId) => {
      logger.info('Client connected: %s', sessionId);
      await options?.onClientConnected?.(sessionId);
    },

    onClientDisconnected: async (sessionId) => {
      logger.info('Client disconnected: %s', sessionId);
      await options?.onClientDisconnected?.(sessionId);
    },
  };
}

// ============================================================================
// Komodo Client Factory
// ============================================================================

/**
 * Creates a Komodo client from environment variables.
 *
 * Supports both API Key and Username/Password authentication.
 *
 * @returns Promise resolving to KomodoClient if credentials available, undefined otherwise
 */
export async function createKomodoClientFromEnv(): Promise<KomodoClient | undefined> {
  const creds = getKomodoCredentials();

  if (!creds.url) {
    logger.debug('No KOMODO_URL configured');
    return undefined;
  }

  try {
    if (creds.apiKey && creds.apiSecret) {
      logger.info('Configuring Komodo client with API Key for %s', creds.url);
      return KomodoClientClass.connectWithApiKey(creds.url, creds.apiKey, creds.apiSecret);
    }

    if (creds.username && creds.password) {
      logger.info('Configuring Komodo client with credentials for %s', creds.url);
      return await KomodoClientClass.login(creds.url, creds.username, creds.password);
    }

    logger.debug('No Komodo credentials configured');
    return undefined;
  } catch (error) {
    logger.warn('Failed to create Komodo client: %s', error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

// ============================================================================
// Komodo Server Options
// ============================================================================

/**
 * Default Komodo MCP Server options.
 *
 * Provides a complete, ready-to-use configuration for the Komodo MCP Server.
 *
 * @example
 * ```typescript
 * const server = new McpServerBuilder<KomodoClient>()
 *   .withOptions(komodoServerOptions)
 *   .withToolProvider(toolRegistryAdapter)
 *   .build();
 * ```
 */
export const komodoServerOptions: IServerOptions<KomodoClient> = {
  // Server identity
  name: SERVER_NAME,
  version: SERVER_VERSION,

  // Transport configuration (from environment)
  transport: {
    mode: config.MCP_TRANSPORT === 'http' ? 'http' : 'stdio',
    http: {
      port: config.MCP_PORT,
      host: config.MCP_BIND_HOST,
    },
  },

  // Capabilities
  capabilities: {
    tools: { listChanged: true },
    resources: { listChanged: true },
    prompts: { listChanged: true },
    logging: true,
  },

  // Lifecycle hooks
  lifecycle: createKomodoLifecycleHooks(),

  // Shutdown configuration
  shutdown: {
    timeoutMs: SHUTDOWN_CONFIG.TIMEOUT_MS,
    forceExitOnTimeout: true,
    signals: ['SIGINT', 'SIGTERM'],
  },

  // Client factory (auto-connect from env)
  clientFactory: async () => {
    const client = await createKomodoClientFromEnv();
    if (!client) {
      throw new Error('No Komodo credentials configured - use komodo_configure tool');
    }
    return client;
  },

  // Auto-connect disabled - we handle initialization manually
  autoConnect: false,

  // Telemetry (from environment)
  telemetryEnabled: config.OTEL_ENABLED,
  telemetryServiceName: SERVER_NAME,
};

/**
 * Creates customized Komodo server options.
 *
 * Merges custom options with defaults.
 *
 * @param overrides - Options to override defaults
 * @returns Complete server options with overrides applied
 *
 * @example
 * ```typescript
 * const options = createKomodoServerOptions({
 *   transport: { mode: 'http', http: { port: 8080 } },
 *   lifecycle: {
 *     onStarted: () => console.log('Custom startup!'),
 *   },
 * });
 * ```
 */
export function createKomodoServerOptions(
  overrides?: Partial<IServerOptions<KomodoClient>>,
): IServerOptions<KomodoClient> {
  // Determine transport mode (override > default)
  const transportMode = overrides?.transport?.mode ?? komodoServerOptions.transport?.mode ?? 'stdio';

  return {
    ...komodoServerOptions,
    ...overrides,
    // Deep merge transport options
    transport: {
      mode: transportMode,
      http: {
        ...komodoServerOptions.transport?.http,
        ...overrides?.transport?.http,
      },
    },
    // Deep merge capabilities
    capabilities: {
      ...komodoServerOptions.capabilities,
      ...overrides?.capabilities,
    },
    // Merge lifecycle hooks
    lifecycle: overrides?.lifecycle ? createKomodoLifecycleHooks(overrides.lifecycle) : komodoServerOptions.lifecycle,
    // Deep merge shutdown
    shutdown: {
      ...komodoServerOptions.shutdown,
      ...overrides?.shutdown,
    },
  };
}
