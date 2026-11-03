/**
 * Resource Link Helper
 *
 * Bridges Komodo tool handlers to the framework's `DynamicResourceRegistry`.
 * Session-bound clients receive ephemeral `resource_link` content by default.
 * Operators can choose inline delivery or automatic offloading above a UTF-8
 * byte threshold. Stateless callers and explicit `inline_full=true` opt-outs
 * continue to receive the full payload inline.
 *
 * Registered content is secret-scrubbed by the registry itself (scrub-on-
 * register, wired in `src/index.ts`); inline fallbacks pass the framework's
 * tool-result boundary instead — callers never scrub here.
 *
 * @module utils/resource-link
 */

import { getDynamicResourceRegistry, type ResourceLinkSpec, type ToolContext } from "mcp-server-framework";
import { config } from "../config/index.js";

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
 * link spec, or `null` when the delivery policy selects inline content,
 * the caller is stateless, or inline-full is explicitly requested.
 *
 * Callers use the return value to decide between two output shapes:
 * - link spec → emit summary + resource link, drop the full payload from the body
 * - `null`    → inline the full payload as before
 *
 * Registration failures are swallowed (as in the original link mode) — the caller
 * always falls back to inlining so that a registry hiccup never breaks
 * the tool.
 */
export function tryRegisterResource(opts: RegisterResourceOptions): ResourceLinkSpec | null {
  if (opts.inlineFull) return null;
  if (config.MCP_RESOURCE_RESPONSE_MODE === "inline") return null;
  const sessionId = opts.ctx.sessionId;
  if (!sessionId) return null;

  // Measure the already-serialized candidate without allocating another buffer
  // or caching it. Redaction still runs at the existing boundaries, after this
  // decision; a large raw payload is never inlined just because scrubbing shrinks it.
  if (config.MCP_RESOURCE_RESPONSE_MODE === "auto") {
    const bytes = typeof opts.content === "string" ? Buffer.byteLength(opts.content, "utf8") : opts.content.byteLength;
    if (bytes <= config.MCP_RESOURCE_INLINE_THRESHOLD_BYTES) return null;
  }

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
