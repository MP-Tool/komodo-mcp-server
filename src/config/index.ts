/**
 * Configuration Module
 *
 * @module config
 */

// Server identity
export const SERVER_NAME = "komodo-mcp-server";
export { APP_VERSION as SERVER_VERSION } from "./version.js";

// Environment
export { config, getKomodoCredentials, type KomodoCredentials, type AppEnvConfig } from "./env.js";

// Config file section
export { registerKomodoConfigSection, type KomodoFileConfig } from "./env.js";

// Tool defaults
export { VALIDATION_LIMITS, CONTAINER_LOGS_DEFAULTS, LOG_SEARCH_DEFAULTS } from "./tools.config.js";

// Descriptions
export {
  RESPONSE_ICONS,
  PARAM_DESCRIPTIONS,
  CONFIG_DESCRIPTIONS,
  LOG_DESCRIPTIONS,
  FIELD_DESCRIPTIONS,
  RESTART_MODE_DESCRIPTIONS,
  PRUNE_TARGET_DESCRIPTIONS,
  ALERT_DESCRIPTIONS,
  THRESHOLD_DESCRIPTIONS,
} from "./descriptions.js";
