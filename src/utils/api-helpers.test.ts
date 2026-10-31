// komodo_client requires the localStorage polyfill before its first import.
import "./polyfills.js";

import { test } from "node:test";
import assert from "node:assert/strict";
import { Types } from "komodo_client";
import { parseGetPermissionLevel } from "./api-helpers.js";

test("GetPermission accepts bare levels when there are no specific permissions (#217)", () => {
  for (const level of [
    Types.PermissionLevel.None,
    Types.PermissionLevel.Read,
    Types.PermissionLevel.Execute,
    Types.PermissionLevel.Write,
  ]) {
    assert.equal(parseGetPermissionLevel(level), level);
  }
});

test("GetPermission accepts the level-and-specifics object shape (#217)", () => {
  const response: Types.PermissionLevelAndSpecifics = {
    level: Types.PermissionLevel.Execute,
    specific: [],
  };
  assert.equal(parseGetPermissionLevel(response), Types.PermissionLevel.Execute);
});

test("GetPermission refuses unknown and malformed responses without silently granting access", () => {
  const invalid = [undefined, null, "", "ADMIN", {}, { level: undefined }, { level: "SuperAdmin" }];
  for (const value of invalid) {
    assert.throws(() => parseGetPermissionLevel(value), /Unexpected Komodo GetPermission response/);
  }
});
