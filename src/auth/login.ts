/**
 * Komodo MCP Server — Login Page
 *
 * Komodo-specific implementation of {@link LoginPageRenderer}.
 * Uses Komodo brand colors, the official Komodo lizard logo (from assets/favicon.svg),
 * Bootstrap 5.3 for layout, and full prefers-color-scheme dark/light support.
 *
 * Pass {@link komodoLoginPage} as `renderLoginPage` to `createOAuthProvider` so the
 * Komodo-branded page is served instead of the framework's generic default.
 *
 * @module auth/login
 */

import type { LoginPageRenderer, SelectableProvider, LocalLoginForm } from "mcp-server-framework";

// ============================================================================
// Komodo Login Page Renderer
// ============================================================================

/**
 * The Komodo-branded {@link LoginPageRenderer}.
 * Pass this to `createOAuthProvider({ renderLoginPage: komodoLoginPage, ... })`.
 */
export const komodoLoginPage: LoginPageRenderer = {
  renderSelectionPage,
  renderSuccessRedirectPage,
};

// ============================================================================
// Implementation
// ============================================================================

function renderSuccessRedirectPage(redirectUrl: string): string {
  const safeUrl = escapeHtml(redirectUrl);
  // No JavaScript — meta refresh is CSP-safe (not subject to script-src) and fires after
  // the browser has painted the page, so the Komodo-styled confirmation is actually visible.
  // All CSS is inline: no external dependencies, no race with CDN loading.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="1; url=${safeUrl}">
  <title>Komodo MCP Server</title>
  <link rel="icon" type="image/svg+xml" href="${FAVICON_DATA_URI}">
  <style>
    ${CALLBACK_CSS}
  </style>
</head>
<body>
  <div class="card">
    <div class="check-circle" aria-hidden="true">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
    <p class="label">Signed in</p>
    <p class="sub">Redirecting&hellip;</p>
    <a href="${safeUrl}" class="link">Continue if not redirected automatically</a>
  </div>
</body>
</html>`;
}

function renderSelectionPage(
  originalUrl: string,
  providers: readonly SelectableProvider[],
  localForm?: LocalLoginForm,
  error?: string,
): string {
  const hasLocal = localForm !== undefined;
  const hasProviders = providers.length > 0;

  const providerButtons = providers
    .map((prov) => {
      const separator = originalUrl.includes("?") ? "&" : "?";
      const href = `${originalUrl}${separator}provider=${encodeURIComponent(prov.name)}`;
      return `<a href="${escapeHtml(href)}" class="provider-btn d-flex align-items-center gap-3 w-100 text-decoration-none mb-2">
          <span class="provider-icon">${providerIconSvg(prov.name)}</span>
          <span>Continue with ${escapeHtml(prov.displayName)}</span>
        </a>`;
    })
    .join("\n");

  // OAuth-only error (no local form) — shown above the provider buttons
  const topErrorBanner =
    error && !hasLocal
      ? `<div class="error-banner mb-3" role="alert">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          ${escapeHtml(error)}
        </div>`
      : "";

  // Local-login error — shown inside the form, between password and submit button
  const inlineError =
    error && hasLocal
      ? `<div class="error-inline" role="alert">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          ${escapeHtml(error)}
        </div>`
      : "";

  const divider = hasLocal && hasProviders ? `<div class="divider my-4"><span>or</span></div>` : "";

  const localFormHtml = localForm
    ? `<form method="POST" action="/authorize/local" novalidate>
        <input type="hidden" name="redirect_uri"  value="${escapeHtml(localForm.redirectUri)}">
        <input type="hidden" name="state"          value="${escapeHtml(localForm.state)}">
        <input type="hidden" name="code_challenge" value="${escapeHtml(localForm.codeChallenge)}">
        <input type="hidden" name="authorize_url"  value="${escapeHtml(originalUrl)}">
        <div class="mb-3">
          <label for="username" class="form-label">Username</label>
          <input id="username" type="text" name="username" class="form-control"
                 placeholder="username" autocomplete="username"
                 autocapitalize="off" spellcheck="false" required>
        </div>
        <div class="mb-3">
          <label for="password" class="form-label">Password</label>
          <input id="password" type="password" name="password" class="form-control"
                 placeholder="••••••••" autocomplete="current-password" required>
        </div>
        ${inlineError}
        <button type="submit" class="btn btn-komodo w-100 mt-1">Login</button>
      </form>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign In - Komodo MCP Server</title>
  <link rel="icon" type="image/svg+xml" href="${FAVICON_DATA_URI}">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
  <style>
    ${BASE_CSS}
  </style>
</head>
<body class="d-flex align-items-center justify-content-center min-vh-100">
  <div class="login-card">
    <div class="brand d-flex align-items-center gap-3 mb-4">
      ${KOMODO_LOGO_SVG}
      <div class="brand-text">
        <div class="brand-name">Komodo</div>
        <div class="brand-sub">MCP Server</div>
      </div>
    </div>
    <h1 class="login-title">Sign in to Komodo MCP Server</h1>
    ${topErrorBanner}
    ${providerButtons}
    ${divider}
    ${localFormHtml}
  </div>
</body>
</html>`;
}

// ============================================================================
// Internal: Komodo lizard logo — from src/auth/assets/favicon.svg
// Dark mode: shifts fill from #2D4138 (forest) to #4db87a (Komodo green)
// so the mark remains visible on the dark card background.
// favicon.ico in assets/ is available for future static-file serving.
// ============================================================================

const KOMODO_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 620"
     width="42" height="42" aria-label="Komodo" role="img">
  <style>.k{fill:#2D4138;}@media(prefers-color-scheme:dark){.k{fill:#4db87a;}}</style>
  <path class="k" d="M307.63,394.44c5.57,7.75,5.57,7.75,4.7,13.66c-3.7-2.66-7.69-4.33-9.89-7.32
    c-8.38-11.38-13.42-24.1-16.02-38.21c-1.86-10.12-6.66-19.68-9.87-29.57c-1.15-3.55-1.76-7.34-2.14-11.07
    c-0.35-3.46-0.08-6.98-0.08-10.97c-6.55,4.58-12.18,0.3-17.66-1.5c-8.19-2.68-14.96-7.77-20.75-14.54
    c-4.23-4.96-9.78-8.95-15.23-12.66c-5.89-4.01-9.44-8.41-8.65-16.14c0.65-6.35-3.37-11.84-8.98-13.83
    c0.96,4.97,1.89,9.59,2.74,14.23c2.2,12.01-0.24,23.47-4.1,34.79c-5.51,16.17-11.08,32.32-16.22,48.61
    c-1.61,5.11-1.92,10.62-2.74,15.97c-0.11,0.73,0.03,1.89,0.51,2.27c6.17,4.92,6.36,12.68,9.12,19.19
    c0.71,1.66,0.47,3.72,0.77,6.71c-4.71-2.96-8.15-6.47-12.84-3.51c-1.28,0.8-2.52,1.81-3.45,2.98
    c-3.13,3.93-6.12,7.97-10.19,13.31c2.63-9.16-7.25-8.57-8.54-14.6c-5.46,2.89-13.69,0.42-15.67,9.63
    c-0.48-0.23-0.96-0.46-1.44-0.69c0-2.66-0.27-5.35,0.06-7.96c0.48-3.71-0.66-5.9-4.47-6.66
    c-1.62-0.32-3.15-1.12-4.98-1.8c-2.15,1.79-4.49,3.73-6.82,5.67c-0.45-0.22-0.91-0.44-1.36-0.67
    c1.02-2.74,1.27-6.47,3.23-8.02c3.8-2.99,5.2-7.05,7.21-10.95c0.92-1.78,1.83-3.8,3.32-5.02
    c11.54-9.47,13.99-23.15,15.49-36.47c1.95-17.26,2.33-34.66,5.83-51.81c3.15-15.44,4.7-31.22,8-46.63
    c2.42-11.28,7.09-21.89,18.88-26.87c10.32-4.36,20.01-3.77,29.75,2.76c6.34,4.25,13.85,6.85,20.99,9.8
    c15,6.2,30.56,10.71,46.6,13.06c6.73,0.98,13.73,0.16,20.61-0.41c-5.49-2.75-10.94-3.03-16.96-2.49
    c-5.47,0.49-11.22-1.87-16.81-3.13c-1.28-0.29-2.41-1.19-3.61-1.81c3.87-6.03,3.87-6.03,18.36-14.84
    c-3.43,0.79-7.03,1.15-10.25,2.45c-5.45,2.2-10.52,5.42-16.05,7.34c-2.61,0.91-6.18,0.5-8.85-0.52
    c-8.86-3.39-17.54-7.28-26.23-11.11c-1.28-0.56-2.26-1.82-3.98-3.27c7.34-2.91,14.04-5.31,20.53-8.2
    c10.58-4.71,21.47-4.4,32.57-2.91c3.28,0.44,6.68,0.18,10.02,0.06c3.72-0.13,6.88-1.29,9.67-4.16
    c12.07-12.39,26.6-20.91,43.32-25.13c10.51-2.65,21.29-4.34,32.03-5.96c14.04-2.11,24.04-9.06,29.22-22.51
    c2.91-7.57-0.02-14.14-4.08-20.02c-8.14-11.81-18.95-20.31-32.93-24.48c-7.91-2.36-15.6-5.65-23.63-7.38
    c-7.83-1.69-15.96-2.34-23.99-2.74c-12.35-0.61-24.86-1.87-37.05-0.55c-12.66,1.37-25.09,5.21-37.48,8.46
    c-14.83,3.9-28.44,10.75-41.74,18.26c-30.51,17.24-56.31,39.68-76.76,68.3c-12.79,17.9-22.95,37.16-30.3,57.76
    c-8.44,23.68-12.83,48.26-13.26,73.47c-0.3,17.91,1.43,35.57,5,53.17c6.3,31.07,18.58,59.44,36.54,85.44
    c19.44,28.14,43.92,50.81,73.31,68.38c17.62,10.54,36.25,18.69,55.87,24.16c18.52,5.17,37.49,8.84,56.95,8.09
    c14.37-0.55,28.88-0.21,43.06-2.21c13.4-1.89,26.65-5.63,39.57-9.8c17.67-5.7,34.26-13.95,49.97-24
    c28.89-18.48,52.57-42.09,71.33-70.78c11.57-17.69,23.48-35.22,31.07-55.05c5.56-14.54,10.26-29.44,14.57-44.4
    c7.49-26.01,8.54-52.8,7.43-79.62c-0.48-11.49-2.29-22.98-4.27-34.34c-3.64-20.88-9.67-41.2-18.7-60.33
    c-7.56-16.02-16.78-31.26-24.94-46.25c-0.1-0.06,1.1,0.27,1.83,1.04c21.3,22.68,38.62,48.07,51.33,76.48
    c6.79,15.18,12.01,30.92,16.23,47.09c5.84,22.36,8.35,45.09,8.48,68c0.09,16.72-1.53,33.43-4.55,50.03
    c-3.76,20.7-9.61,40.71-17.82,59.97c-10.69,25.1-24.87,48.16-42.43,69.14c-22.28,26.63-48.46,48.51-78.68,65.56
    c-17.38,9.8-35.63,17.73-54.7,23.42c-24.69,7.37-49.96,12.09-75.86,11.85c-14.42-0.13-28.88-0.63-43.22-2.02
    c-10.3-1-20.59-3.18-30.61-5.84c-20.32-5.39-39.96-12.64-58.81-22.19c-28.68-14.52-54.02-33.4-76.09-56.65
    c-21.45-22.6-39.34-47.77-51.51-76.58c-6.29-14.88-12.46-29.96-16.75-45.49c-4.73-17.1-7.98-34.7-8.58-52.8
    c-0.39-11.96-0.39-23.76-0.39-36.02c0.61-5.32,1.03-10.23,1.86-15.07c2.16-12.7,3.54-25.64,7-37.99
    c4.19-14.98,9.26-29.88,15.67-44.04c6.29-13.89,14.27-27.09,22.34-40.07c12.99-20.91,29.94-38.56,48.04-55.07
    c22.73-20.75,48.66-36.73,76.96-48.45c14.33-5.93,29.52-9.94,44.54-13.99c28.89-7.79,58.37-9.04,88.1-6.63
    c20.43,1.65,39.2,8.43,57.63,17.06c12.04,5.64,22.89,12.63,32.33,21.85c9.51,9.28,16.04,20.56,21.04,32.74
    c2.82,6.87,5.78,13.75,7.89,20.85c6.13,20.67-1.19,37.96-16.21,51.46c-14.19,12.75-31.47,14.93-49.9,9.24
    c-12.25-3.78-24.96-6.43-37.83-4.86c-7.11,0.87-13.82,4.12-18.2,10.34c8.01-1.49,16.02-3.84,24.12-4.22
    c7.27-0.34,14.69,1.2,21.96,2.42c11.27,1.88,22.04,6.31,33.89,5.43c4.1-0.3,8.56,1.53,12.54,3.15
    c3.65,1.49,6.87,4,11.53,6.82c-9.57,4.89-17.99,9.88-26.96,13.57c-8.76,3.61-18.01,6.13-27.18,8.66
    c-4.07,1.12-8.53,1.77-12.67,1.32c-2.43-0.26-4.85-2.85-6.79-4.86c-3.15-3.28-6.56-5.82-11.89-7.13
    c3.61,4.19,6.58,7.64,10.43,12.11c-7.47-0.23-13.63-4.11-19.54,1.5c11.31,0.75,22.61,2.02,33.92,2.04
    c5.47,0.01,11.02-2.09,16.41-3.68c7.28-2.15,14.53-4.48,21.62-7.19c8.45-3.23,16.57-7.33,25.08-10.36
    c9.33-3.33,18.73,0.18,25.48,7.8c6.43,7.27,9.35,15.39,9.19,25.13c-0.26,16.18-1.36,32.21-3.57,48.29
    c-1.54,11.19-1.35,22.88-0.04,34.13c1.15,9.97,5.61,18.92,14.41,25.5c3.78,2.83,5.51,8.4,8.17,12.73
    c0.37,0.6,0.62,1.5,1.15,1.73c4.78,2.02,5.57,6.32,6.55,12.36c-3.18-1.7-5.52-2.92-7.84-4.18
    c-3.14-1.71-6.37-4.55-9.22,0.28c-0.6,1.02-0.78,2.44-0.74,3.66c0.08,2.3,0.46,4.58,0.79,7.51
    c-1.4-0.53-2.53-0.62-2.68-1.05c-2.32-6.89-9-6.85-14.25-8.98c-2.12-0.86-5.84,3.07-6.24,6.12
    c-0.31,2.39-0.87,4.75-1.32,7.13c-0.49,0.03-0.98,0.07-1.48,0.1c-0.96-2.41-2.38-4.74-2.8-7.23
    c-1.63-9.73-9.97-13.24-17.89-7.36c-0.82,0.61-1.83,0.95-3.31,1.08c3.36-6.76-0.19-15.12,6.86-21.2
    c4.73-4.07,3.88-11.19,2.92-16.91c-1.98-11.79-4.89-23.42-7.45-35.1c-1.34-6.13-3.93-12.26-3.83-18.35
    c0.11-6.24,2.8-12.44,4.42-18.64c0.86-3.26,1.86-6.49,2.99-10.44c-6.07,1.46-7.4,6.08-9.37,9.87
    c-1.27,2.44-1.14,5.7-2.65,7.91c-2.52,3.71-5.31,7.69-8.94,10.13c-10.16,6.85-20.77,13.03-31.3,19.32
    c-1.7,1.01-3.87,1.26-5.86,1.73c-6.68,1.56-9.99,0.38-14.08-5.3c-0.22,1.02-0.57,1.67-0.46,2.25
    c2.63,14.15-1.01,27.44-5,40.84c-2.8,9.43-4.39,19.23-6.53,28.86c-2.1,9.45-2.99,19.43-8.67,27.58
    c-4.64,6.65-10.13,12.89-19.4,11.97c-2.56,12.78-1.66,25.03,3.53,36.92c-0.61,0.23-1.22,0.46-1.84,0.69
    c-2.28-4.45-4.56-8.9-6.91-13.47c-2.41,4.12-4.83,8.26-8,13.69c-0.77-2.35-1.5-3.37-1.25-4.04
    c1.19-3.3,2.48-6.58,4.03-9.72c3.43-6.92,3.06-14.47,1.71-21.39c-0.82-4.23-0.45-7.06,1.52-9.93
    c2.49-0.45,4.79-0.87,7.08-1.29c-0.12-0.37-0.25-0.75-0.37-1.12c-5.36-1.31-10.73-2.61-16.59-4.38
    c-1.19-0.56-1.9-0.66-2.6-0.76C306.44,393.45,307.03,393.94,307.63,394.44z"/>
  <path class="k" d="M200.06,345.86c-3.03,0.51-5.66,0.93-9.07,1.47c2.27-5.88,4.67-11.26,6.43-16.83
    c4.48-14.19,8.63-28.48,13.03-42.7c0.48-1.54,1.71-2.85,2.6-4.26c1.16,0.91,2.45,1.7,3.47,2.74
    c5.32,5.47,1.97,11.37,0.19,16.78c-1.38,4.18-4.21,7.9-6.56,11.72c-4.97,8.07-6.3,16.91-5.57,26.13
    C204.84,344.23,203.52,345.59,200.06,345.86z"/>
  <path class="k" d="M419.69,285.83c1.49-0.93,2.68-1.63,4.47-2.69c0.66,3.08,1.28,5.92,1.86,8.76
    c2.54,12.5,5.4,24.94,7.37,37.53c0.51,3.24,4.06,8.23-2.08,10.5c-0.96,0.35-2.54,0.4-3.19-0.16
    c-0.68-0.58-0.96-2.14-0.77-3.14c2.59-13.57-1.26-26.05-5.98-38.52C419.95,294.38,420,290.09,419.69,285.83z"/>
</svg>`;

// Favicon embedded as Base64 data URI so the browser tab shows the Komodo lizard.
const FAVICON_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(KOMODO_LOGO_SVG).toString("base64")}`;

// ============================================================================
// Internal: CSS — Bootstrap overrides + Komodo color tokens
// ============================================================================

const BASE_CSS = `
  /* ── Color tokens ── */
  :root {
    --bg:            #f0f5f1;
    --card:          #ffffff;
    --border:        #cdd8cf;
    --text:          #111111;
    --muted:         #576059;
    --green:         #2e8555;
    --green-hover:   #256b44;
    --green-active:  #1e5437;
    --green-subtle:  #e8f5ed;
    --green-ring:    rgba(46,133,85,0.20);
    --green-shadow:  rgba(46,133,85,0.28);
    --input-bg:      #ffffff;
    --input-border:  #cdd8cf;
    --provider-hover:#f3faf5;
    --placeholder:   rgba(0,0,0,0.36);
    --or-text:       #9ca3a0;
    --or-line:       #d8dbd9;
    --error-bg:      #fff0f0;
    --error-border:  #f5c6cb;
    --error-text:    #8b1a1a;
    --shadow:        0 4px 24px rgba(46,133,85,0.10), 0 1px 4px rgba(0,0,0,0.06);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg:            #0d1510;
      --card:          #19211b;
      --border:        #2a3d2e;
      --text:          #e2ede5;
      --muted:         #7da082;
      --green:         #4db87a;
      --green-hover:   #5dcc8a;
      --green-active:  #3da066;
      --green-subtle:  rgba(77,184,122,0.14);
      --green-ring:    rgba(77,184,122,0.22);
      --green-shadow:  rgba(77,184,122,0.28);
      --input-bg:      #111a14;
      --input-border:  #2a3d2e;
      --provider-hover:#1d2b20;
      --placeholder:   rgba(226,237,229,0.32);
      --or-text:       #606866;
      --or-line:       #2c3330;
      --error-bg:      #2c1010;
      --error-border:  #5a2020;
      --error-text:    #f4a0a0;
      --shadow:        0 4px 24px rgba(0,0,0,0.50), 0 1px 4px rgba(0,0,0,0.30);
    }
  }

  /* ── Base ── */
  body { background: var(--bg) !important; color: var(--text); -webkit-font-smoothing: antialiased; }

  /* ── Card ── */
  .login-card {
    background: var(--card);
    border-radius: 14px;
    box-shadow: var(--shadow);
    border: 1px solid var(--border);
    border-left: 3px solid var(--green);
    padding: 40px 36px;
    width: 100%;
    max-width: 384px;
  }

  /* ── Brand ── */
  .brand-text { display: flex; flex-direction: column; }
  .brand-name { font-size: 1.125rem; font-weight: 700; letter-spacing: -0.01em; color: var(--text); line-height: 1.2; }
  .brand-sub  { font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: var(--muted); margin-top: 1px; }
  .login-title { font-size: 1.125rem; font-weight: 600; margin-bottom: 1rem; color: var(--text); }

  /* ── Bootstrap form-control: override for Komodo theme ── */
  .form-control {
    background-color: var(--input-bg);
    border-color: var(--input-border);
    color: var(--text);
    font-size: 0.9375rem;
    padding: 0.6875rem 1rem;
    border-radius: 8px;
    border-width: 1.5px;
  }
  .form-control::placeholder { color: var(--placeholder); opacity: 1; }
  .form-control:focus {
    background-color: var(--card);
    border-color: var(--green);
    box-shadow: 0 0 0 0.2rem var(--green-ring);
    color: var(--text);
  }
  .form-label { font-size: 0.875rem; font-weight: 500; color: var(--text); margin-bottom: 0.375rem; }

  /* ── Provider buttons ── */
  .provider-btn {
    padding: 11px 16px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text);
    transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
  }
  .provider-btn:hover {
    background: var(--provider-hover);
    border-color: var(--green);
    box-shadow: 0 0 0 3px var(--green-ring);
    color: var(--text);
  }
  .provider-icon { display: flex; align-items: center; flex-shrink: 0; color: var(--text); }

  /* ── Divider ── */
  .divider { display: flex; align-items: center; color: var(--or-text); font-size: 0.8125rem; }
  .divider::before, .divider::after { content: ""; flex: 1; border-bottom: 1px solid var(--or-line); }
  .divider span { padding: 0 12px; }

  /* ── Login button ── */
  .btn-komodo {
    background: var(--green); color: #fff; border: none;
    font-size: 0.9375rem; font-weight: 600; letter-spacing: 0.01em;
    padding: 0.6875rem 1rem; border-radius: 8px;
    transition: background 0.15s, box-shadow 0.15s;
  }
  .btn-komodo:hover  { background: var(--green-hover);  box-shadow: 0 2px 8px var(--green-shadow); color: #fff; }
  .btn-komodo:active { background: var(--green-active); color: #fff; }
  .btn-komodo:focus-visible { outline: none; box-shadow: 0 0 0 0.2rem var(--green-ring); color: #fff; }

  /* ── Inline error — inside local form, between password and submit ── */
  .error-inline {
    display: flex; align-items: flex-start; gap: 0.5rem;
    background: var(--error-bg); border: 1px solid var(--error-border);
    color: var(--error-text); border-radius: 6px;
    padding: 0.625rem 0.875rem; font-size: 0.875rem;
    margin-bottom: 0.75rem; line-height: 1.4;
  }
  .error-inline svg { flex-shrink: 0; margin-top: 1px; }

  /* ── Top error banner — OAuth-only errors, no local form ── */
  .error-banner {
    display: flex; align-items: flex-start; gap: 0.5rem;
    background: var(--error-bg); border: 1px solid var(--error-border);
    color: var(--error-text); border-radius: 8px;
    padding: 0.625rem 0.875rem; font-size: 0.875rem; line-height: 1.4;
  }
  .error-banner svg { flex-shrink: 0; margin-top: 1px; }
`;

// Self-contained CSS for the OAuth callback success page.
// Intentionally NO Bootstrap CDN — all styles are inline so the page renders on
// the first browser paint without waiting for any external resource to load.
const CALLBACK_CSS = `
  :root {
    --bg:           #f0f5f1;
    --card:         #ffffff;
    --border:       #cdd8cf;
    --text:         #111111;
    --muted:        #576059;
    --green:        #2e8555;
    --green-subtle: #e8f5ed;
    --shadow:       0 4px 24px rgba(46,133,85,0.10), 0 1px 4px rgba(0,0,0,0.06);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg:           #0d1510;
      --card:         #19211b;
      --border:       #2a3d2e;
      --text:         #e2ede5;
      --muted:        #7da082;
      --green:        #4db87a;
      --green-subtle: rgba(77,184,122,0.14);
      --shadow:       0 4px 24px rgba(0,0,0,0.50), 0 1px 4px rgba(0,0,0,0.30);
    }
  }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex; align-items: center; justify-content: center; min-height: 100vh;
    -webkit-font-smoothing: antialiased;
  }
  .card {
    background: var(--card);
    border-radius: 14px;
    box-shadow: var(--shadow);
    border: 1px solid var(--border);
    border-left: 3px solid var(--green);
    padding: 40px 36px;
    width: 100%; max-width: 384px;
    text-align: center;
  }
  @keyframes pop {
    from { transform: scale(0.7); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }
  .check-circle {
    width: 60px; height: 60px; border-radius: 50%;
    background: var(--green-subtle); color: var(--green);
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 1.5rem;
    animation: pop 0.25s ease-out both;
  }
  .label { font-size: 1.0625rem; font-weight: 600; color: var(--text); margin-bottom: 0.25rem; }
  .sub   { font-size: 0.875rem;  color: var(--muted); margin-bottom: 1.5rem; }
  .link  { font-size: 0.8125rem; color: var(--green); text-decoration: none; }
  .link:hover { text-decoration: underline; }
`;

// ============================================================================
// Internal: HTML escaping + provider icons
// ============================================================================

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function providerIconSvg(name: string): string {
  const type = name.startsWith("oidc:") ? "oidc" : name;
  switch (type) {
    case "google":
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>`;
    case "github":
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
      </svg>`;
    default:
      return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"
           xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 8v4l2.5 2.5"/>
      </svg>`;
  }
}
