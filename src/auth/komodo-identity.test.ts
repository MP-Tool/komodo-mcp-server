// Must precede any komodo_client import — mogh_auth_client touches localStorage at
// module load, same reason src/index.ts imports this first.
import "../utils/polyfills.js";

import { test } from "node:test";
import assert from "node:assert/strict";
import { canCreateResource } from "./komodo-identity.js";
import type { KomodoIdentity, CreatableResourceType } from "./komodo-identity.js";

// ============================================================================
// Create-capability derivation.
//
// Pins the mapping against Komodo Core's own `user_can_create`
// (`bin/core/src/resource/*.rs`). The rule that matters: this must never deny
// what Core would allow. Core gates Stack/Deployment/Repo/Procedure/Swarm on
// `disable_non_admin_create`, a Core-side setting the MCP server cannot read —
// those defer. Deferring is always safe: Core still decides, and Core can only
// be stricter.
// ============================================================================

function identity(overrides: Partial<KomodoIdentity> = {}): KomodoIdentity {
  return {
    provider: "local",
    komodoUserId: "u1",
    username: "alice",
    komodoJwt: "jwt",
    isAdmin: false,
    canCreateServers: false,
    canCreateBuilds: false,
    ...overrides,
  };
}

const ADMIN_ONLY: CreatableResourceType[] = ["Action", "Alerter", "Builder", "ResourceSync"];
const CORE_DECIDES: CreatableResourceType[] = ["Stack", "Deployment", "Repo", "Procedure", "Swarm"];

test("admins may create every resource kind", () => {
  const admin = identity({ isAdmin: true });
  for (const type of [...ADMIN_ONLY, ...CORE_DECIDES, "Server", "Build"] as CreatableResourceType[]) {
    assert.equal(canCreateResource(admin, type), "allow", `admin should create ${type}`);
  }
});

test("non-admins are denied the kinds Komodo Core hard-gates to admins", () => {
  const user = identity();
  for (const type of ADMIN_ONLY) {
    assert.equal(canCreateResource(user, type), "deny", `${type} is admin-only in Core`);
  }
});

test("non-admins defer on the kinds gated by Core's disable_non_admin_create", () => {
  const user = identity();
  for (const type of CORE_DECIDES) {
    assert.equal(canCreateResource(user, type), "defer", `${type} depends on Core config`);
  }
});

test("Server creation follows create_server_permissions", () => {
  assert.equal(canCreateResource(identity({ canCreateServers: true }), "Server"), "defer");
  assert.equal(canCreateResource(identity({ canCreateServers: false }), "Server"), "deny");
});

test("Build creation follows create_build_permissions", () => {
  assert.equal(canCreateResource(identity({ canCreateBuilds: true }), "Build"), "defer");
  assert.equal(canCreateResource(identity({ canCreateBuilds: false }), "Build"), "deny");
});

test("the two create flags are independent of one another", () => {
  const serversOnly = identity({ canCreateServers: true });
  assert.equal(canCreateResource(serversOnly, "Server"), "defer");
  assert.equal(canCreateResource(serversOnly, "Build"), "deny");
});

test("anonymous/global mode defers everything to the service account", () => {
  // stdio and auth-disabled HTTP carry no per-user identity; the global Komodo
  // connection's own rights govern, exactly as in requireKomodoPermission.
  for (const type of [...ADMIN_ONLY, ...CORE_DECIDES, "Server", "Build"] as CreatableResourceType[]) {
    assert.equal(canCreateResource(undefined, type), "defer", `anonymous should defer ${type}`);
  }
});

test("a Write permission on some resource does not by itself grant creation", () => {
  // deriveKomodoScopes() hands out komodo:admin to anyone holding Write on a
  // single resource. That scope opens the *_apply tools, so the create branch
  // must not treat it as a create right — this is the gap the pre-check closes.
  const writer = identity({ resourcePermissions: { Stack: "Write" } });
  assert.equal(canCreateResource(writer, "Alerter"), "deny");
  assert.equal(canCreateResource(writer, "Server"), "deny");
});
