/**
 * User Management Tools
 *
 * Tools for managing API keys via the `komodo_client` auth management API.
 * Supports listing, creating, and deleting API keys for the
 * currently authenticated user.
 *
 * @module tools/user
 */

import { defineTool, structured } from "mcp-server-framework";
import type { Types } from "komodo_client";
import { ToolCategories, ToolScopes } from "../config/index.js";
import { AppErrorFactory } from "../errors/index.js";
import { requireClient, wrapApiCall, renderApiKeyList, renderApiKeyCreated, paginate } from "../utils/index.js";
import {
  listApiKeysOutputSchema,
  createApiKeyOutputSchema,
  createApiKeyInputSchema,
  deleteApiKeyInputSchema,
  deleteApiKeyOutputSchema,
  paginationInputSchema,
} from "./schemas/index.js";

type ApiKey = Types.ApiKey;

// ============================================================================
// List API Keys
// ============================================================================

export const listApiKeysTool = defineTool({
  name: "komodo_user_list_api_keys",
  description:
    "List all API keys for the currently authenticated Komodo user. " +
    "Shows key name, key ID (not secret), creation date, and expiry.",
  input: paginationInputSchema,
  output: listApiKeysOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.USER },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const keys = await wrapApiCall("listApiKeys", () => komodo.client.read("ListApiKeys", {}), abortSignal);

    const allItems = keys.map((k: ApiKey) => ({
      name: k.name,
      key: k.key,
      created_at: k.created_at,
      expires: k.expires,
    }));

    const { items, page } = paginate(allItems, args.cursor, args.page_size);
    const payload = { items: [...items], page };
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
  input: createApiKeyInputSchema,
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
    "Accepts either the key name or the full K_... key string. Use komodo_user_list_api_keys to see available keys.",
  input: deleteApiKeyInputSchema,
  output: deleteApiKeyOutputSchema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
  },
  _meta: { category: ToolCategories.USER },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const input = args.name_or_key;

    // If the input already looks like a raw key string, use it directly.
    // Otherwise resolve by name via ListApiKeys.
    let resolvedKey: string;
    let resolvedName: string | undefined;

    if (input.startsWith("K_")) {
      resolvedKey = input;
    } else {
      const keys = await wrapApiCall("listApiKeysForDelete", () => komodo.client.read("ListApiKeys", {}), abortSignal);
      const matches = keys.filter((k) => k.name === input);

      if (matches.length === 0) {
        throw AppErrorFactory.notFound.resource(input, "API key");
      }
      if (matches.length > 1) {
        throw AppErrorFactory.validation.fieldRequired(
          `Multiple API keys named "${input}" exist. Provide the full K_... key string instead.`,
        );
      }
      const match = matches[0];
      if (!match) throw AppErrorFactory.notFound.resource(input, "API key");
      resolvedKey = match.key;
      resolvedName = match.name;
    }

    await wrapApiCall(
      "deleteApiKey",
      () => komodo.client.auth.manage("DeleteApiKey", { key: resolvedKey }),
      abortSignal,
    );

    const label = resolvedName
      ? `**Name:** ${resolvedName}\n\n**Key:** \`${resolvedKey}\``
      : `**Key:** \`${resolvedKey}\``;
    return structured(
      { deleted: true, key_id: resolvedKey, ...(resolvedName && { name: resolvedName }) },
      { text: `✅ API key deleted successfully.\n\n${label}` },
    );
  },
});
