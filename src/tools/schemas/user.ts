/**
 * User Schemas
 *
 * Zod schemas for user-management tool outputs (API key listing/creation).
 *
 * @module tools/schemas/user
 */

import { z } from "mcp-server-framework";
import { pageOutputSchema } from "./shared.js";

// ============================================================================
// Input Schemas
// ============================================================================

/** Input of `komodo_user_create_api_key`. */
export const createApiKeyInputSchema = z
  .object({
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
  })
  .describe("Options for creating a new API key for the authenticated user");

/** Input of `komodo_user_delete_api_key`. */
export const deleteApiKeyInputSchema = z
  .object({
    name_or_key: z
      .string()
      .min(1, "API key name or key ID cannot be empty")
      .describe(
        "The key name (e.g. 'mykey') OR the full key string (e.g. 'K_abc...'). " +
          "Use the name shown in komodo_user_list_api_keys. If multiple keys share the same name, provide the full K_... string.",
      ),
  })
  .describe("Name or key ID of the API key to delete");

/** Output of `komodo_user_delete_api_key`. */
export const deleteApiKeyOutputSchema = z
  .object({
    deleted: z.boolean().describe("Whether the API key was removed"),
    key_id: z.string().describe("The full K_... key string that was deleted"),
    name: z.string().optional().describe("The key name, when resolved by name lookup"),
  })
  .describe("Result envelope for an API key deletion");

// ============================================================================
// Output Schemas
// ============================================================================

/** Compact summary of a single API key (no secret material). */
export const apiKeySummarySchema = z
  .object({
    name: z.string().describe("Human-readable API key name"),
    key: z.string().describe("API key ID (public identifier, not the secret)"),
    created_at: z.number().int().describe("Creation timestamp in milliseconds since epoch"),
    expires: z.number().int().describe("Expiry timestamp in milliseconds since epoch (0 = never)"),
  })
  .describe("Public metadata for an API key");

/** Output of `komodo_user_list_api_keys`. */
export const listApiKeysOutputSchema = z
  .object({
    items: z.array(apiKeySummarySchema).describe("API keys for the authenticated user"),
    page: pageOutputSchema.optional(),
  })
  .describe("List of API keys for the authenticated user");

/**
 * Output of `komodo_user_create_api_key`.
 *
 * Note: `secret` is returned exactly once at creation time and cannot be
 * retrieved later. Clients should persist it immediately.
 */
export const createApiKeyOutputSchema = z
  .object({
    name: z.string().describe("Name assigned to the new key"),
    key: z.string().describe("API key ID (public identifier)"),
    secret: z.string().describe("API key secret — shown only on creation, cannot be retrieved later"),
    expires: z.number().int().describe("Expiry timestamp in milliseconds since epoch (0 = never)"),
  })
  .describe("Newly created API key with its one-time secret");
