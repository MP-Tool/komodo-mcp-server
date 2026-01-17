/**
 * Komodo Resource Configuration Schemas
 *
 * Re-exports configuration schemas used by MCP tools.
 * These schemas provide detailed type information to AI agents
 * so they can construct correct API payloads.
 */

// Deployment schemas (used in deployment/manage.ts)
export {
  PartialDeploymentConfigSchema,
  CreateDeploymentConfigSchema,
  DeploymentImageSchema,
} from './deployment-config.schema.js';

// Stack schemas (used in stack/manage.ts)
export { PartialStackConfigSchema, CreateStackConfigSchema } from './stack-config.schema.js';

// Server schemas (used in server/manage.ts)
export { serverConfigSchema } from './server-config.schema.js';

// Container operation schemas (used in container/prune.ts, container/manage.ts)
export { pruneTargetSchema, containerActionSchema } from './container-operations.schema.js';
