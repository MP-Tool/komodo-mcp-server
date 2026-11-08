import { test } from "node:test";
import assert from "node:assert/strict";
import type { LocalLoginForm } from "mcp-server-framework";
import { komodoLoginPage } from "./login.js";

// ============================================================================
// The login page's notice about who is asking. What it shows comes from outside:
// the application's name is whatever a registration or a document on some website
// says. It must never reach the page as markup.
// ============================================================================

const pending: LocalLoginForm = {
  displayName: "Password",
  redirectUri: "http://127.0.0.1:49152/callback",
  state: "st",
  codeChallenge: "c".repeat(43),
  methods: [{ id: "password", displayName: "Password", identifierLabel: "Username", secretLabel: "Password" }],
  activeMethod: "password",
  redirectHost: "127.0.0.1:49152",
};

const page = (form: Partial<LocalLoginForm>): string =>
  komodoLoginPage.renderSelectionPage("/authorize?x=1", [], { ...pending, ...form });

test("names the application and where the sign-in returns to", () => {
  const html = page({ clientName: "Claude Code" });
  assert.match(html, /Signing in to <strong>Claude Code<\/strong>/);
  assert.match(html, /returns to <code>127\.0\.0\.1:49152<\/code>/);
  assert.doesNotMatch(html, /identified by/);
  assert.doesNotMatch(html, /class="client-warning"/);
});

test("says which website vouches for an application that introduced itself by a web address", () => {
  const html = page({ clientName: "Claude Code", clientIdHost: "claude.ai", redirectHost: "claude.ai" });
  assert.match(html, /<strong>Claude Code<\/strong> \(identified by <code>claude\.ai<\/code>\)/);
  assert.doesNotMatch(html, /class="client-warning"/);
});

test("warns when such an application has the sign-in returned to this device", () => {
  const html = page({ clientName: "Claude Code", clientIdHost: "claude.ai", localRedirect: true });
  assert.match(html, /class="client-warning" role="note"/);
  assert.match(html, /Continue only if you started this sign-in yourself/);
});

test("falls back to a neutral name for an application that gave none", () => {
  assert.match(page({}), /Signing in to <strong>an MCP client<\/strong>/);
});

test("never lets what an application says about itself become markup", () => {
  const html = page({
    clientName: '<img src=x onerror="alert(1)">Trusted & Verified',
    clientIdHost: 'evil.example"><script>alert(2)</script>',
    redirectHost: "<b>host</b>",
    localRedirect: true,
  });
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /<script>alert\(2\)/);
  assert.doesNotMatch(html, /<b>host<\/b>/);
  assert.match(html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt;Trusted &amp; Verified/);
  assert.match(html, /evil\.example&quot;&gt;&lt;script&gt;/);
});
