import "../../utils/polyfills.js"; // must be first — localStorage polyfill for komodo_client's import chain
import { test } from "node:test";
import assert from "node:assert/strict";
import { toBuilderConfig } from "./builder.js";

// --- type inference ----------------------------------------------------------

test("toBuilderConfig returns undefined when no config / no identifying field is given", () => {
  assert.equal(toBuilderConfig(undefined), undefined);
  assert.equal(toBuilderConfig({}), undefined);
});

test("toBuilderConfig honors an explicit builder_type over inference", () => {
  const cfg = toBuilderConfig({ builder_type: "Server", server_id: "srv-1" });
  assert.deepEqual(cfg, { type: "Server", params: { server_ids: ["srv-1"] } });
});

test("toBuilderConfig infers Url from `address`", () => {
  assert.equal(toBuilderConfig({ address: "https://p:8120" })?.type, "Url");
});

test("toBuilderConfig infers Server from `server_id`", () => {
  assert.equal(toBuilderConfig({ server_id: "srv-1" })?.type, "Server");
});

test("toBuilderConfig infers Aws from region/instance_type/ami_id", () => {
  assert.equal(toBuilderConfig({ region: "eu-central-1" })?.type, "Aws");
  assert.equal(toBuilderConfig({ instance_type: "c5.xlarge" })?.type, "Aws");
  assert.equal(toBuilderConfig({ ami_id: "ami-123" })?.type, "Aws");
});

// --- Server: single server_id → SDK server_ids array (regression) ------------

test("toBuilderConfig maps the friendly server_id to the SDK's server_ids array", () => {
  const cfg = toBuilderConfig({ builder_type: "Server", server_id: "srv-1" });
  assert.deepEqual(cfg, { type: "Server", params: { server_ids: ["srv-1"] } });
});

test("toBuilderConfig yields empty Server params when server_id is absent", () => {
  assert.deepEqual(toBuilderConfig({ builder_type: "Server" }), { type: "Server", params: {} });
});

// --- Url: only Url-relevant fields are kept ----------------------------------

test("toBuilderConfig keeps only Url fields and drops unrelated ones", () => {
  const cfg = toBuilderConfig({
    builder_type: "Url",
    address: "https://p:8120",
    insecure_tls: true,
    passkey: "pk",
    region: "eu-central-1", // Aws field — must be dropped
    server_id: "srv-1", // Server field — must be dropped
  });
  assert.deepEqual(cfg, {
    type: "Url",
    params: { address: "https://p:8120", insecure_tls: true, passkey: "pk" },
  });
});

// --- Aws: full field pass-through, unrelated dropped -------------------------

test("toBuilderConfig assembles Aws params and drops non-Aws fields", () => {
  const cfg = toBuilderConfig({
    builder_type: "Aws",
    region: "eu-central-1",
    instance_type: "c5.xlarge",
    volume_gb: 20,
    security_group_ids: ["sg-1", "sg-2"],
    port: 8120,
    use_https: true,
    address: "https://p:8120", // Url field — must be dropped
  });
  assert.deepEqual(cfg, {
    type: "Aws",
    params: {
      region: "eu-central-1",
      instance_type: "c5.xlarge",
      volume_gb: 20,
      security_group_ids: ["sg-1", "sg-2"],
      port: 8120,
      use_https: true,
    },
  });
});

test("toBuilderConfig omits fields left undefined (no explicit undefined keys)", () => {
  const cfg = toBuilderConfig({ builder_type: "Url", address: "https://p:8120" });
  assert.deepEqual(Object.keys(cfg?.params ?? {}), ["address"]);
});
