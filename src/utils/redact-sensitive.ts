/** Stable replacement used for values removed from tool and resource output. */
export const REDACTION_MARKER = "[REDACTED]";

const SENSITIVE_KEY_PARTS = [
  "password",
  "passwd",
  "passphrase",
  "secret",
  "token",
  "credential",
  "authorization",
  "cookie",
  "apikey",
  "accesskey",
  "privatekey",
  "signingkey",
] as const;

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part));
}

function decodeKey(key: string): string {
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

function redactString(input: string): string {
  const assignmentsRedacted = input.replace(
    /(^|[\r\n])([A-Za-z_][A-Za-z0-9_.-]*)(\s*[:=]\s*)([^\r\n]*)/g,
    (match, prefix: string, key: string, separator: string) =>
      isSensitiveKey(key) ? `${prefix}${key}${separator}${REDACTION_MARKER}` : match,
  );

  const userInfoRedacted = assignmentsRedacted.replace(
    /([a-z][a-z0-9+.-]*:\/\/[^:/\s?#]+:)([^@\s/]+)(@)/gi,
    `$1${REDACTION_MARKER}$3`,
  );

  return userInfoRedacted.replace(/([?&])([^=&\s]+)=([^&#\s]*)/g, (match, prefix: string, key: string) =>
    isSensitiveKey(decodeKey(key)) ? `${prefix}${key}=${REDACTION_MARKER}` : match,
  );
}

/**
 * Return a deep, non-mutating copy with credential-bearing values removed.
 *
 * This runs before inline serialization and before payloads enter the dynamic
 * resource registry, so both MCP delivery paths receive the same safe value.
 */
export function redactSensitiveData(value: unknown): unknown {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map((item) => redactSensitiveData(item));
  if (value === null || typeof value !== "object") return value;

  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    output[key] = isSensitiveKey(key) ? REDACTION_MARKER : redactSensitiveData(child);
  }
  return output;
}
