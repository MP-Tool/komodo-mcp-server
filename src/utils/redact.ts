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
 * with the `KOMODO_SECRET_SCRUB_*` env extensions.
 *
 * There is deliberately no redaction CODE in Komodo anymore — supersedes the
 * bespoke `redactAlerterEndpoint` / `redactDeployedSecrets` / `maskSecretValue`
 * helpers (PR #162, issue #160).
 *
 * @module utils/redact
 */
import { REDACTED_VALUE } from "mcp-server-framework/logger";
import type { SecretScrubberOptions } from "mcp-server-framework/logger";

/**
 * Redaction marker — the framework `SecretScrubber`'s own `REDACTED_VALUE`,
 * re-exported for renderers/tests that need to recognize redacted output.
 */
export const REDACTED = REDACTED_VALUE;

/**
 * Komodo field names that key-based heuristics would over-redact via substring
 * matching but which are never actually secret. Extendable via
 * `KOMODO_SECRET_SCRUB_ALLOW_KEYS`.
 */
export const KOMODO_SCRUB_ALLOW_KEYS: readonly string[] = [
  "public_key",
  "attempted_public_key",
  "periphery_public_key",
  "skip_secret_interp",
  "auto_rotate_keys",
  "is_secret",
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
