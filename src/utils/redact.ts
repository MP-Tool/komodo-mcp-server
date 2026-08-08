/**
 * Komodo secret-redaction POLICY.
 *
 * Komodo declares WHAT to redact here; the framework implements HOW — once,
 * for everything: the tool-result boundary (`scrubToolResults`), offloaded
 * resources (`DynamicResourceRegistry` scrub-on-register, JSON scrubbed as
 * objects), and forwarded log notifications all apply this same policy.
 * Values masked in structured content are also purged from the rendered text
 * of the same result (the boundary's value collector), so the declarative
 * rules below reach every representation. Wired in `src/index.ts` together
 * with the `MCP_SECRET_SCRUB_*` env extensions.
 *
 * There is deliberately no redaction CODE in Komodo anymore — supersedes the
 * bespoke `redactAlerterEndpoint` / `redactDeployedSecrets` / `maskSecretValue`
 * helpers (PR #162, issue #160).
 *
 * @module utils/redact
 */
import { REDACTED_VALUE } from "mcp-server-framework/logger";
import type { SecretScrubberOptions } from "mcp-server-framework/logger";
import { getFrameworkConfig } from "mcp-server-framework";
import type { ScrubToolResultsConfig } from "mcp-server-framework";
import { config } from "../config/index.js";

/**
 * Redaction marker — the framework `SecretScrubber`'s own `REDACTED_VALUE`,
 * re-exported for renderers/tests that need to recognize redacted output.
 */
export const REDACTED = REDACTED_VALUE;

/**
 * Komodo field names that key-based heuristics would over-redact via substring
 * matching but which are never actually secret. Extendable via
 * `MCP_SECRET_SCRUB_ALLOW_KEYS`.
 */
export const KOMODO_SCRUB_ALLOW_KEYS: readonly string[] = [
  "public_key",
  "attempted_public_key",
  "periphery_public_key",
  "skip_secret_interp",
  "auto_rotate_keys",
  "is_secret",
  // A boolean flag stating that secrets ARE masked — the substring "secret" would otherwise
  // redact it, turning `true` into a placeholder string and breaking output validation.
  "secrets_masked",
];

/**
 * Declarative domain rules for cases the generic heuristics can structurally
 * never detect:
 *
 * - `dropKeys`: stacks' post-interpolation deploy artifacts — `[[variable.x]]`
 *   references already expanded to real values, and bulky; removed entirely
 *   (the source config `file_contents`/`environment` is retained).
 * - `sensitivePaths`: the alerter endpoint URL/email — innocuous key names
 *   (`url`, `email`), no detectable value shape, but for Slack/Discord/Ntfy/
 *   Pushover the URL IS the secret. Path-scoped so ordinary URLs elsewhere
 *   stay readable.
 * - `maskWhenSibling`: Komodo Variables carry their own sensitivity flag —
 *   `value` is masked whenever `is_secret` is true (core only redacts
 *   non-admin reads, and write responses echo the plaintext).
 */
export const KOMODO_SCRUB_RULES: Pick<SecretScrubberOptions, "dropKeys" | "sensitivePaths" | "maskWhenSibling"> = {
  dropKeys: ["deployed_config", "deployed_contents"],
  sensitivePaths: ["endpoint.params.url", "endpoint.params.email"],
  maskWhenSibling: [{ sibling: "is_secret", keys: ["value"] }],
};

// ============================================================================
// Configuration Composition (framework base ← Komodo extension)
// ============================================================================

/**
 * Resolve the redaction master switch from both layers.
 *
 * The framework's generic `MCP_SCRUB_ENABLED` is the BASE; Komodo's
 * `MCP_SECRET_SCRUB_ENABLED` is the EXTENSION and wins whenever it is set.
 * Neither set ⇒ on, because redaction is a security default, not an opt-in.
 *
 * Split out from {@link isSecretRedactionEnabled} so the precedence can be
 * tested as a matrix — both inputs come from process-wide caches that a single
 * test process cannot re-resolve.
 *
 * @param komodo - `MCP_SECRET_SCRUB_ENABLED`, or `undefined` when unset
 * @param framework - `MCP_SCRUB_ENABLED`, or `undefined` when unset
 */
export function resolveRedactionSwitch(komodo: boolean | undefined, framework: boolean | undefined): boolean {
  return komodo ?? framework ?? true;
}

/** Whether secret redaction is active. See {@link resolveRedactionSwitch} for the precedence. */
export function isSecretRedactionEnabled(): boolean {
  return resolveRedactionSwitch(config.MCP_SECRET_SCRUB_ENABLED, getFrameworkConfig().MCP_SCRUB_ENABLED);
}

/**
 * The effective scrub configuration, composed from both layers.
 *
 * Deliberately does NOT go through the framework's `resolveScrubConfig()`:
 * that helper lets the framework env override the consumer's config, which is
 * the opposite precedence, and it drops {@link KOMODO_SCRUB_RULES} entirely
 * when the base resolves to `false`. Composing here keeps the domain rules
 * attached to every enabled outcome, no matter which switch enabled it.
 *
 * Key lists are UNIONED across layers — a key declared in either place is
 * honored, so neither layer can silently narrow the other.
 *
 * Cheap enough to call per use (`getFrameworkConfig()` is itself cached), so
 * it stays un-memoized and therefore testable.
 */
export function resolveScrubOptions(): ScrubToolResultsConfig {
  if (!isSecretRedactionEnabled()) return false;

  const framework = getFrameworkConfig();
  return {
    ...KOMODO_SCRUB_RULES,
    additionalKeys: [...(framework.MCP_SCRUB_ADDITIONAL_KEYS ?? []), ...(config.MCP_SECRET_SCRUB_KEYS ?? [])],
    allowKeys: [
      ...(framework.MCP_SCRUB_ALLOW_KEYS ?? []),
      ...KOMODO_SCRUB_ALLOW_KEYS,
      ...(config.MCP_SECRET_SCRUB_ALLOW_KEYS ?? []),
    ],
  };
}
