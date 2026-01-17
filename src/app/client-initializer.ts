/**
 * Komodo MCP Client Initializer
 *
 * Handles automatic initialization of the Komodo client from environment variables.
 * Supports both API Key and Username/Password authentication methods.
 *
 * This is the application-specific layer that uses KomodoClient and komodoConnectionManager.
 *
 * @module app/client-initializer
 */

import { KomodoClient } from './api/index.js';
import { getKomodoCredentials } from './config/index.js';
import { logger } from './framework.js';
import { komodoConnectionManager } from './connection.js';
import { toolRegistry } from './mcp/tools/index.js';

/**
 * Attempts to initialize the Komodo client from environment variables.
 * Reads credentials at runtime to support Docker env_file loading.
 * Supports both API Key and Username/Password authentication.
 *
 * @returns Promise that resolves when initialization is complete (success or failure)
 */
export async function initializeKomodoClientFromEnv(): Promise<void> {
  // Read credentials at runtime (important for Docker containers where
  // env_file variables are only available after container start)
  const creds = getKomodoCredentials();

  if (!creds.url) {
    logger.info('No KOMODO_URL configured - use komodo_configure tool to connect');
    return;
  }

  // Log available credentials (without sensitive values)
  logger.debug(
    'Runtime credentials check: url=%s, username=%s, apiKey=%s',
    creds.url,
    !!creds.username,
    !!creds.apiKey,
  );

  try {
    let client: KomodoClient;

    if (creds.apiKey && creds.apiSecret) {
      logger.info('Attempting API Key configuration for %s...', creds.url);
      client = KomodoClient.connectWithApiKey(creds.url, creds.apiKey, creds.apiSecret);
    } else if (creds.username && creds.password) {
      logger.info('Attempting auto-configuration for %s...', creds.url);
      client = await KomodoClient.login(creds.url, creds.username, creds.password);
    } else {
      logger.info('No Komodo credentials configured - use komodo_configure tool to connect');
      return;
    }

    // Connect via komodoConnectionManager (validates with health check)
    const success = await komodoConnectionManager.connect(client);

    if (success) {
      logger.info('✅ Auto-configuration successful - %d tools now available', toolRegistry.getAvailableTools().length);
    } else {
      logger.warn('⚠️ Auto-configuration failed: health check failed');
    }
  } catch (error) {
    logger.warn('⚠️ Auto-configuration failed: %s', error instanceof Error ? error.message : String(error));
  }
}
