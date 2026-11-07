/**
 * A real browser for the checks that only a browser can make: Content-Security-Policy,
 * cookies, redirects after a form was submitted, single sign-on sessions.
 *
 * Drives the locally installed Chrome (or Chromium / Brave / Edge) headless through the
 * Chrome DevTools Protocol, in a throw-away profile. Node 22 built-ins only. Where no such
 * browser is installed, `browserPath()` is `undefined` and the callers skip their checks.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

/** The browser binary this machine has, or `undefined`. */
export const browserPath = () => CANDIDATES.find((candidate) => fs.existsSync(candidate));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Finds an element anywhere in the page, shadow roots included (identity providers build
 * their login pages from web components). Evaluated inside the page.
 */
const DEEP = `(function deep(selector, root) {
  root = root || document;
  const hit = root.querySelector(selector);
  if (hit) return hit;
  for (const el of root.querySelectorAll("*")) {
    if (el.shadowRoot) { const inner = deep(selector, el.shadowRoot); if (inner) return inner; }
  }
  return null;
})`;

/**
 * Launches a headless browser with an empty profile.
 *
 * @param options.hostRules - Chrome `--host-resolver-rules`, e.g. `MAP authentik 127.0.0.1`
 */
export async function launchBrowser({ hostRules } = {}) {
  const binary = browserPath();
  if (!binary) throw new Error("no Chrome-family browser found (set CHROME_PATH)");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-verify-browser-"));
  const child = spawn(
    binary,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--disable-extensions",
      ...(hostRules ? [`--host-resolver-rules=${hostRules}`] : []),
      // Extra switches for environments that need them (CI: `CHROME_FLAGS=--no-sandbox`).
      ...(process.env.CHROME_FLAGS?.split(/\s+/).filter(Boolean) ?? []),
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  const endpoint = await new Promise((resolve, reject) => {
    let stderr = "";
    const timer = setTimeout(() => reject(new Error(`the browser did not start: ${stderr.slice(-300)}`)), 20_000);
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      const match = /DevTools listening on (ws:\/\/\S+)/.exec(stderr);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.on("exit", (code) => reject(new Error(`the browser exited (${code}): ${stderr.slice(-300)}`)));
  });

  const socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", () => reject(new Error("cannot connect to the browser")), { once: true });
  });
  let nextId = 0;
  const waiting = new Map();
  const listeners = new Set();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined) {
      const pending = waiting.get(message.id);
      waiting.delete(message.id);
      if (pending) message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
      return;
    }
    for (const listener of listeners) listener(message);
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      waiting.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }));
    });

  /** Opens a tab. Every tab shares the profile — cookies and provider sessions included. */
  async function newPage() {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const page = { requests: [], blocked: [] };
    listeners.add((message) => {
      if (message.sessionId !== sessionId) return;
      // Every document the tab asked for — also the ones that could not be loaded.
      if (message.method === "Network.requestWillBeSent" && message.params.type === "Document") {
        page.requests.push(message.params.request.url);
      }
      // What the browser refused to do, in its own words (CSP, mixed content, …).
      if (message.method === "Log.entryAdded" && ["error", "warning"].includes(message.params.entry.level)) {
        page.blocked.push(message.params.entry.text);
      }
      if (message.method === "Audits.issueAdded") {
        const csp = message.params.issue.details?.contentSecurityPolicyIssueDetails;
        if (csp) page.blocked.push(`CSP ${csp.violatedDirective} blocked ${csp.blockedURL ?? "(inline)"}`);
      }
    });
    for (const domain of ["Page", "Runtime", "Network", "Log", "Audits"]) await send(`${domain}.enable`, {}, sessionId);

    const evaluate = async (expression) => {
      const { result, exceptionDetails } = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      return result.value;
    };
    Object.assign(page, {
      goto: async (url) => {
        await send("Page.navigate", { url }, sessionId);
      },
      evaluate,
      /** The address the tab is at now. */
      url: () => evaluate("location.href").catch(() => "(navigating)"),
      text: () => evaluate("document.body ? document.body.innerText : ''").catch(() => ""),
      /** Whether an element exists (shadow roots included). */
      has: (selector) => evaluate(`Boolean(${DEEP}(${JSON.stringify(selector)}))`).catch(() => false),
      /** Types into a field the way a person would be seen to by the page's scripts. */
      fill: (selector, value) =>
        evaluate(`(() => { const el = ${DEEP}(${JSON.stringify(selector)}); if (!el) return false;
          el.focus(); el.value = ${JSON.stringify(value)};
          el.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
          el.dispatchEvent(new Event("change", { bubbles: true, composed: true })); return true; })()`),
      click: (selector) =>
        evaluate(`(() => { const el = ${DEEP}(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`),
      /** Waits until `probe()` is truthy; returns its value, or `undefined` after the timeout. */
      waitFor: async (probe, timeoutMs = 20_000) => {
        const until = Date.now() + timeoutMs;
        while (Date.now() < until) {
          const value = await Promise.resolve(probe()).catch(() => undefined);
          if (value) return value;
          await sleep(200);
        }
        return undefined;
      },
      close: () => send("Target.closeTarget", { targetId }).catch(() => {}),
    });
    return page;
  }

  return {
    newPage,
    close: async () => {
      const exited = new Promise((resolve) => child.once("exit", resolve));
      try {
        await send("Browser.close");
      } catch {
        /* already gone */
      }
      socket.close();
      // The profile can only be removed once the browser has let go of it.
      await Promise.race([exited, sleep(3000)]);
      child.kill("SIGKILL");
      try {
        fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {
        /* a leftover temp directory is not worth failing a check for */
      }
    },
  };
}
