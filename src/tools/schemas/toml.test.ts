import "../../utils/polyfills.js"; // must be first — localStorage polyfill for komodo_client's import chain
import { test } from "node:test";
import assert from "node:assert/strict";
import { splitList, splitResourceTarget } from "./toml.js";

test("splitList splits on commas and newlines, trimming and dropping empties", () => {
  assert.deepEqual(splitList("prod, web"), ["prod", "web"]);
  assert.deepEqual(splitList("Stack:web\nDeployment:api"), ["Stack:web", "Deployment:api"]);
  assert.deepEqual(splitList(" a , , b ,\n c \n"), ["a", "b", "c"]);
});

test("splitList returns an empty array for blank input", () => {
  assert.deepEqual(splitList(""), []);
  assert.deepEqual(splitList("  ,  \n "), []);
});

test("splitResourceTarget parses a well-formed 'Type:id' entry", () => {
  assert.deepEqual(splitResourceTarget("Stack:web"), { type: "Stack", id: "web" });
  assert.deepEqual(splitResourceTarget("Deployment:api"), { type: "Deployment", id: "api" });
});

test("splitResourceTarget trims surrounding whitespace", () => {
  assert.deepEqual(splitResourceTarget(" Server : prod-1 "), { type: "Server", id: "prod-1" });
});

test("splitResourceTarget splits on the FIRST colon only", () => {
  // Ids never contain a colon in Komodo, but be explicit about the contract.
  assert.deepEqual(splitResourceTarget("Stack:a:b"), { type: "Stack", id: "a:b" });
});

test("splitResourceTarget returns null for malformed input", () => {
  assert.equal(splitResourceTarget("web"), null); // no colon
  assert.equal(splitResourceTarget(":web"), null); // empty type
  assert.equal(splitResourceTarget("Stack:"), null); // empty id
  assert.equal(splitResourceTarget(""), null);
  assert.equal(splitResourceTarget("   :   "), null); // blank after trim
});
