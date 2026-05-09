/**
 * User Schemas
 *
 * Zod schemas for user-management tool outputs (API key listing/creation).
 *
 * @module tools/schemas/user
 */

import { z } from "mcp-server-framework";
import { pageOutputSchema } from "./shared.js";

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
