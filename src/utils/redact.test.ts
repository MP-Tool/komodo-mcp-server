import { test } from "node:test";
import assert from "node:assert/strict";
import { parse as tomlParse, stringify as tomlStringify } from "smol-toml";
import { SecretScrubber, scrubByMimeType } from "mcp-server-framework/logger";
import { REDACTED, KOMODO_SCRUB_ALLOW_KEYS, KOMODO_SCRUB_RULES } from "./redact.js";

const scrubber = new SecretScrubber({ allowKeys: [...KOMODO_SCRUB_ALLOW_KEYS], ...KOMODO_SCRUB_RULES });

const KOMODO_EXPORT_TOML = `[[variable]]
name = "DB_PASSWORD"
value = "hunter2-actual-production-password"
is_secret = true

[[variable]]
name = "PUBLIC_HOST"
value = "example.com"
is_secret = false

[[server]]
name = "prod-1"

[server.config]
address = "https://periphery.internal:8120"
passkey = "example-passkey-must-be-masked"

[[alerter]]
name = "slack-prod"

[alerter.endpoint.params]
url = "https://hooks.slack.com/services/T00/B00/SECRETWEBHOOK"
`;

interface ExportFixture {
  title: string;
  created_at: Date;
  metadata: { "dotted.label": string; enabled: boolean; counts: number[] };
  variable: [{ value: string; is_secret: boolean }, { value: string }];
  server: [{ config: { address: string; passkey: string } }];
  alerter: [{ endpoint: { params: { url: string } } }];
}

void test("policy(toml): null-prototype tables survive structural scrub, serialization and validation", () => {
  const parsed = tomlParse(
    'title = "export-é漢😀"\ncreated_at = 2026-11-02T00:00:00Z\n' +
      'metadata = { "dotted.label" = "ordinary", enabled = true, counts = [1, 2, 3] }\n' +
      KOMODO_EXPORT_TOML,
  ) as unknown as ExportFixture;
  for (const table of [parsed, parsed.metadata, parsed.variable[0], parsed.server[0].config]) {
    assert.equal(Object.getPrototypeOf(table), null);
    assert.equal(table.hasOwnProperty, undefined);
  }
  const serialized = tomlStringify(scrubber.scrubObject(parsed));
  const validated = tomlParse(serialized) as unknown as ExportFixture;
  assert.equal(Object.getPrototypeOf(validated), null);
  assert.equal(validated.title, "export-é漢😀");
  assert.equal(validated.created_at.toISOString(), parsed.created_at.toISOString());
  assert.equal(validated.metadata["dotted.label"], "ordinary");
  assert.equal(validated.metadata.enabled, true);
  assert.deepEqual(validated.metadata.counts, [1, 2, 3]);
  assert.equal(validated.variable[0].value, REDACTED);
  assert.equal(validated.variable[0].is_secret, true);
  assert.equal(validated.variable[1].value, "example.com");
  assert.equal(validated.server[0].config.passkey, REDACTED);
  assert.equal(validated.alerter[0].endpoint.params.url, REDACTED);
  assert.equal(validated.server[0].config.address, "https://periphery.internal:8120");
  // The framework's own TOML MIME parser/serializer must handle the new objects too.
  assert.deepEqual(tomlParse(scrubByMimeType(serialized, "application/toml", scrubber)), validated);
});
