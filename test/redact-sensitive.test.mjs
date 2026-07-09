import assert from "node:assert/strict";
import test from "node:test";

async function loadRedactor() {
  try {
    return await import("../build/utils/redact-sensitive.js");
  } catch {
    return {};
  }
}

test("exports a sensitive-data redactor", async () => {
  const { redactSensitiveData } = await loadRedactor();
  assert.equal(typeof redactSensitiveData, "function");
});

test("redacts nested sensitive keys case-insensitively", async () => {
  const { redactSensitiveData, REDACTION_MARKER } = await loadRedactor();
  const input = {
    apiSecret: "sentinel-secret",
    nested: { PASSWORD: "sentinel-password", normal: "visible" },
  };

  assert.deepEqual(redactSensitiveData(input), {
    apiSecret: REDACTION_MARKER,
    nested: { PASSWORD: REDACTION_MARKER, normal: "visible" },
  });
});

test("redacts sensitive assignments in multiline environment strings", async () => {
  const { redactSensitiveData, REDACTION_MARKER } = await loadRedactor();
  const input = "PUBLIC_NAME=visible\nKOMODO_API_SECRET=sentinel-secret\nACCESS_TOKEN: sentinel-token";

  assert.equal(
    redactSensitiveData(input),
    `PUBLIC_NAME=visible\nKOMODO_API_SECRET=${REDACTION_MARKER}\nACCESS_TOKEN: ${REDACTION_MARKER}`,
  );
});

test("redacts sensitive entries in Docker Env arrays while preserving ordinary values", async () => {
  const { redactSensitiveData, REDACTION_MARKER } = await loadRedactor();
  const input = { Config: { Env: ["PORT=9180", "API_KEY=sentinel-key", "DB_PASSWORD=sentinel-password"] } };

  assert.deepEqual(redactSensitiveData(input), {
    Config: { Env: ["PORT=9180", `API_KEY=${REDACTION_MARKER}`, `DB_PASSWORD=${REDACTION_MARKER}`] },
  });
});

test("redacts URL credentials and sensitive query parameters", async () => {
  const { redactSensitiveData, REDACTION_MARKER } = await loadRedactor();
  const input = {
    endpoint: "https://user:sentinel-password@example.test/hook?token=sentinel-token&view=full",
  };

  assert.deepEqual(redactSensitiveData(input), {
    endpoint: `https://user:${REDACTION_MARKER}@example.test/hook?token=${REDACTION_MARKER}&view=full`,
  });
});

test("preserves malformed URL query keys without throwing", async () => {
  const { redactSensitiveData } = await loadRedactor();
  assert.equal(redactSensitiveData("https://example.test/?%ZZ=value"), "https://example.test/?%ZZ=value");
});
