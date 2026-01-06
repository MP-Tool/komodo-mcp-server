import { z } from 'zod';
import { Tool } from '../base.js';
import { ERROR_MESSAGES } from '../../config/constants.js';
import { PARAM_DESCRIPTIONS, CONFIG_DESCRIPTIONS } from '../../config/descriptions.js';
import { PartialStackConfigSchema, CreateStackConfigSchema } from '../schemas/index.js';

/**
 * Tool to get detailed information about a stack.
 */
export const getStackInfoTool: Tool = {
  name: 'komodo_get_stack_info',
  description:
    'Get detailed information about a Compose stack including configuration, current state, compose file contents, services, and environment variables.',
  schema: z.object({
    stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID_FOR_INFO),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.stacks.get(args.stack);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
};

/**
 * Tool to create a new stack.
 */
export const createStackTool: Tool = {
  name: 'komodo_create_stack',
  description: `Create a new Docker Compose stack in Komodo.

REQUIRED: name
RECOMMENDED: server_id (target server)

STACK MODES:
- Compose Mode: Set server_id for single-server docker compose
- Swarm Mode: Set swarm_id to deploy as Docker Swarm stack

FILE SOURCES (choose one):
1. file_contents: Define compose YAML directly in the config
2. repo + branch: Clone from git repository
3. files_on_host: Use existing files on the server

COMMON CONFIG OPTIONS:
- file_contents: Docker Compose YAML content
- environment: Env vars written to .env file
- auto_pull: Pull images before deploying
- destroy_before_deploy: Run 'down' before 'up'
- extra_args: Additional docker compose arguments`,
  schema: z.object({
    name: z.string().describe(PARAM_DESCRIPTIONS.STACK_NAME),
    server_id: z.string().optional().describe(PARAM_DESCRIPTIONS.SERVER_ID_FOR_COMPOSE),
    config: CreateStackConfigSchema.optional().describe(CONFIG_DESCRIPTIONS.STACK_CONFIG_CREATE),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);

    // Build the config object
    const stackConfig: Record<string, unknown> = {
      ...args.config,
    };
    if (args.server_id) {
      stackConfig.server_id = args.server_id;
    }

    const result = await client.stacks.create(args.name, stackConfig);
    return {
      content: [
        {
          type: 'text',
          text: `Stack "${args.name}" created successfully.\n\nStack Name: ${result.name}\n\nFull Result:\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  },
};

/**
 * Tool to update a stack.
 */
export const updateStackTool: Tool = {
  name: 'komodo_update_stack',
  description: `Update an existing Docker Compose stack configuration.

PATCH-STYLE UPDATE: Only specify fields you want to change.

COMMON UPDATE SCENARIOS:
- Update compose file: { file_contents: "version: '3'\\nservices:..." }
- Change env vars: { environment: "DB_HOST=localhost\\nDB_PORT=5432" }
- Enable auto-pull: { auto_pull: true }
- Switch git branch: { branch: "develop" }
- Move to different server: { server_id: "new-server-id" }
- Enable auto-updates: { auto_update: true }
- Add extra args: { extra_args: ["--remove-orphans"] }
- Configure webhooks: { webhook_enabled: true }`,
  schema: z.object({
    stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID_FOR_UPDATE),
    config: PartialStackConfigSchema.describe(CONFIG_DESCRIPTIONS.STACK_CONFIG_PARTIAL),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.stacks.update(args.stack, args.config);
    return {
      content: [
        {
          type: 'text',
          text: `Stack "${args.stack}" updated successfully.\n\nResult: ${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  },
};

/**
 * Tool to delete a stack.
 */
export const deleteStackTool: Tool = {
  name: 'komodo_delete_stack',
  description: 'Delete a stack',
  schema: z.object({
    stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.stacks.delete(args.stack);
    return {
      content: [
        {
          type: 'text',
          text: `Stack "${args.stack}" deleted successfully.\n\nDeleted Stack:\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  },
};
