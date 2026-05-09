/**
 * Resource Link Helper
 *
 * Bridges Komodo tool handlers to the framework's `DynamicResourceRegistry`.
 * For session-bound clients, large payloads (inspect output, full logs,
 * compose files) are stored ephemerally and surfaced as a `resource_link`
 * content block plus a `resourceLink` field in the structured payload.
 * Stateless callers and explicit `inline_full=true` opt-outs continue to
 * receive the full payload inline.
 *
 * @module utils/resource-link
 */

import { getDynamicResourceRegistry, type ResourceLinkSpec, type ToolContext } from "mcp-server-framework";

/** Logical category for a registered resource (segments the URI). */
export type ResourceCategory = "info" | "inspect" | "logs" | "compose";

/**
 * Caller surface — only the parts of `ToolContext` we actually need.
 *
 * Keeping the dependency narrow lets unit tests stub the context with
 * a plain object instead of constructing a full `ToolContext`.
 */
export type ResourceLinkContext = Pick<ToolContext, "sessionId">;

/** Options for {@link tryRegisterResource}. */
export interface RegisterResourceOptions {
  /** Tool context — `sessionId` decides whether registration is possible. */
  readonly ctx: ResourceLinkContext;
  /** Logical category (URI path segment). */
  readonly category: ResourceCategory;
  /** Display name surfaced on the link (e.g. resource id, container name). */
  readonly name: string;
  /** MIME type of the stored content (e.g. `application/json`, `text/plain`). */
  readonly mimeType: string;
  /** Payload to register. */
  readonly content: string | Uint8Array;
  /** TTL in milliseconds. */
  readonly ttlMs: number;
  /** Inline-full opt-out from the tool's input arguments. */
  readonly inlineFull?: boolean | undefined;
  /** Optional short description rendered alongside the link. */
  readonly description?: string;
}

/**
 * Register `content` in the dynamic resource registry and return a
 * link spec, or `null` if registration must be skipped (stateless caller
 * or explicit inline-full opt-out).
 *
 * Callers use the return value to decide between two output shapes:
 * - link spec → emit summary + resource link, drop the full payload from the body
 * - `null`    → inline the full payload as before
 *
 * Registration failures are swallowed (logged-and-fallback) — the caller
 * always falls back to inlining so that a registry hiccup never breaks
 * the tool.
 */
export function tryRegisterResource(opts: RegisterResourceOptions): ResourceLinkSpec | null {
  if (opts.inlineFull) return null;
  const sessionId = opts.ctx.sessionId;
  if (!sessionId) return null;

  try {
    const { uri } = getDynamicResourceRegistry().register({
      sessionId,
      category: opts.category,
      mimeType: opts.mimeType,
      content: opts.content,
      ttlMs: opts.ttlMs,
    });

    return {
      uri,
      name: opts.name,
      mimeType: opts.mimeType,
      ...(opts.description !== undefined && { description: opts.description }),
    };
  } catch {
    return null;
  }
}
