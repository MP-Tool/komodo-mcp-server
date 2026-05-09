/**
 * User Management Tools
 *
 * Tools for managing API keys via the `komodo_client` auth management API.
 * Supports listing, creating, and deleting API keys for the
 * currently authenticated user.
 *
 * @module tools/user
 */

import { defineTool, structured, text, z } from "mcp-server-framework";
import type { Types } from "komodo_client";
import { ToolCategories, ToolScopes } from "../config/index.js";
import { requireClient, wrapApiCall, renderApiKeyList, renderApiKeyCreated } from "../utils/index.js";
import { listApiKeysOutputSchema, createApiKeyOutputSchema } from "./schemas/index.js";

type ApiKey = Types.ApiKey;

// ============================================================================
// List API Keys
// ============================================================================

export const listApiKeysTool = defineTool({
  name: "komodo_user_list_api_keys",
  description:
    "List all API keys for the currently authenticated Komodo user. " +
    "Shows key name, key ID (not secret), creation date, and expiry.",
  input: z.object({}),
  output: listApiKeysOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.USER },
  requiredScopes: [ToolScopes.READ],
  handler: async (_args, { abortSignal }) => {
    const komodo = requireClient();
    const keys = await wrapApiCall("listApiKeys", () => komodo.client.read("ListApiKeys", {}), abortSignal);

    const items = keys.map((k: ApiKey) => ({
      name: k.name,
      key: k.key,
      created_at: k.created_at,
      expires: k.expires,
    }));

    const payload = { items };
    return structured(payload, { text: renderApiKeyList(payload) });
  },
});

// ============================================================================
// Create API Key
// ============================================================================

export const createApiKeyTool = defineTool({
  name: "komodo_user_create_api_key",
  description:
    "Create a new API key for the currently authenticated Komodo user. " +
    "Returns the key and secret — the secret is shown only once and cannot be retrieved later. " +
    "Optionally set an expiry time.",
  input: z.object({
    name: z
      .string()
      .min(1, "API key name cannot be empty")
      .max(100, "API key name is too long")
      .describe("A descriptive name for the API key"),
    expires_in_days: z
      .number()
      .int()
      .min(0)
      .max(3650)
      .default(0)
      .describe("Number of days until the key expires. 0 means no expiry. Default: 0"),
  }),
  output: createApiKeyOutputSchema,
  annotations: { readOnlyHint: false },
  _meta: { category: ToolCategories.USER },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();

    const expires = args.expires_in_days > 0 ? Date.now() + args.expires_in_days * 24 * 60 * 60 * 1000 : 0;

    const result = await wrapApiCall(
      "createApiKey",
      () => komodo.client.auth.manage("CreateApiKey", { name: args.name, expires }),
      abortSignal,
    );

    const payload = {
      name: args.name,
      key: result.key,
      secret: result.secret,
      expires,
    };
    return structured(payload, { text: renderApiKeyCreated(payload) });
  },
});

// ============================================================================
// Delete API Key
// ============================================================================

export const deleteApiKeyTool = defineTool({
  name: "komodo_user_delete_api_key",
  description:
    "Delete an API key for the currently authenticated Komodo user. " +
    "Requires the key ID (not the secret). Use komodo_user_list_api_keys to find key IDs.",
  input: z.object({
    key: z
      .string()
      .min(1, "API key cannot be empty")
      .describe("The API key ID to delete (use komodo_user_list_api_keys to find it)"),
  }),
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
  },
  _meta: { category: ToolCategories.USER },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    await wrapApiCall("deleteApiKey", () => komodo.client.auth.manage("DeleteApiKey", { key: args.key }), abortSignal);

    return text(`✅ API key deleted successfully.\n\n**Key:** \`${args.key}\``);
  },
});
