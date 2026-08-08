import "../../utils/polyfills.js"; // must be first — localStorage polyfill for komodo_client's import chain
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  deploymentConfigSchema,
  stackConfigSchema,
  serverConfigSchema,
  repoConfigSchema,
  buildConfigSchema,
  actionConfigSchema,
  procedureConfigSchema,
  alerterConfigSchema,
  swarmConfigSchema,
} from "./index.js";

/**
 * Drift tripwire: each hand-written Zod config schema is cast to `Types._Partial*Config`
 * in its `*_apply` handler, which silences TypeScript — exactly how the builder
 * `server_id` vs `server_ids` bug stayed invisible. This guard fails if a schema grows a
 * key the SDK interface doesn't have. It checks field NAMES only (the schema is a curated
 * subset, and some field types intentionally differ); it does not type-check.
 *
 * Regex-over-`.d.ts` — mildly fragile if the SDK changes its declaration formatting.
 * Path is resolved from the project root (where `npm test` runs).
 */
const SDK = readFileSync("node_modules/komodo_client/dist/types.d.ts", "utf8");

function sdkInterfaceFields(name: string): Set<string> {
  // `name` is a hard-coded SDK interface name from the table below, never external
  // input, and carries no regex metacharacters.
  // eslint-disable-next-line security/detect-non-literal-regexp
  const m = new RegExp(`export interface ${name}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(SDK);
  const body = m?.[1];
  if (body === undefined) throw new Error(`SDK interface '${name}' not found in types.d.ts`);
  const fields = new Set<string>();
  for (const fm of body.matchAll(/\n {4}(\w+)\??:/g)) {
    if (fm[1] !== undefined) fields.add(fm[1]);
  }
  return fields;
}

const PAIRS: Array<[string, { shape: Record<string, unknown> }, string]> = [
  ["deployment", deploymentConfigSchema, "DeploymentConfig"],
  ["stack", stackConfigSchema, "StackConfig"],
  ["server", serverConfigSchema, "ServerConfig"],
  ["repo", repoConfigSchema, "RepoConfig"],
  ["build", buildConfigSchema, "BuildConfig"],
  ["action", actionConfigSchema, "ActionConfig"],
  ["procedure", procedureConfigSchema, "ProcedureConfig"],
  ["alerter", alerterConfigSchema, "AlerterConfig"],
  ["swarm", swarmConfigSchema, "SwarmConfig"],
];

for (const [label, schema, iface] of PAIRS) {
  test(`config schema '${label}' has no keys absent from SDK ${iface}`, () => {
    const sdk = sdkInterfaceFields(iface);
    const extra = Object.keys(schema.shape).filter((k) => !sdk.has(k));
    assert.deepEqual(extra, [], `${label} schema keys not in SDK ${iface}: [${extra.join(", ")}]`);
  });
}
