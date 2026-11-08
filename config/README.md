# Configuration Reference

Central reference for how the Komodo MCP Server behaves and how to configure it.

The server is configured through **environment variables**, a **config file** (TOML, YAML, JSON), or both (env wins). This page covers the server's behavior, the priority chain, and the most important settings. For the **complete per-setting reference**, see [`example.config.toml`](./example.config.toml) (and the `.yaml` / `.env` variants). For client- and deployment-specific setup, see [`examples/`](../examples/README.md) and [`docker/`](../docker/README.md).

## How the Server Behaves

Since 1.5.0 the server is **secure by default**:

- **Authentication is on by default** for `http`/`https`. Every caller authenticates with a Komodo credential - in a browser (username/password or API key) or without one (OAuth `client_credentials`) - and acts as that Komodo user with that user's permissions. Turn it off with `MCP_AUTH_ENABLED=false`.
- **An open network server is read-only.** If you disable auth on `http`/`https`, anonymous callers get **read-only** access - every write/exec/delete tool (including `komodo_exec`) is hidden and rejected. The only way to write over the network is to authenticate; no setting lifts this. **stdio** is local and always fully capable.
- **Fail-closed on misconfiguration.** If auth is on but no Komodo URL/credentials are configured, the server rejects every request instead of running open.
- **Per-resource permission checks.** Authenticated calls verify the user's Komodo permission on the target resource *before* running.
- **Destructive actions ask first.** Deletes, `destroy`, prune, `komodo_exec`, and procedure/action/sync runs require explicit confirmation in the client (MCP elicitation), fail-closed.
- **Secrets are redacted** from tool output at a central, fail-closed boundary before they reach the client transcript or the model.
- **The tool surface can be limited** - restrict which tools clients may use (e.g. read-only, no terminal access) and keep the tool list small.

**Naming convention:** `KOMODO_*` configures the *connection to Komodo Core*; `MCP_*` (and `LOG_*` / `OTEL_*`) configures *this MCP server's own behavior*.

## Configuration Priority

The server follows the [12-Factor App](https://12factor.net/config) methodology. Configuration sources are merged top-down - **higher sources override lower ones**:

```
┌─────────────────────────────────┐  ← Highest priority
│   Environment Variables         │    (process.env, docker -e, compose environment:)
├─────────────────────────────────┤
│   Config File                   │    (config.toml / config.yaml / config.json)
├─────────────────────────────────┤
│   .env File                     │    (auto-loaded from working directory)
├─────────────────────────────────┤
│   Defaults                      │    (built-in defaults)
└─────────────────────────────────┘  ← Lowest priority
```

**Example:** If `LOG_LEVEL=debug` is set in `config.toml` but `LOG_LEVEL=warn` is set as an environment variable, the effective value is `warn`.

## Config File Formats

The server supports three config file formats. All are functionally equivalent - choose whichever you prefer.

| Format | Filename | Notes |
|--------|----------|-------|
| **TOML** | `config.toml` | Recommended - comments, readable, explicit types |
| **YAML** | `config.yaml` / `config.yml` | Familiar to Docker/Kubernetes users |
| **JSON** | `config.json` | No comments - least recommended |

### Auto-Discovery

When no explicit path is specified, the server searches the working directory for config files in this order:

```
config.toml -> config.yaml -> config.yml -> config.json
```

The **first file found** is used. If none is found, the server runs with environment variables and defaults only.

### Explicit Path

Override auto-discovery by setting the config file path:

```bash
MCP_CONFIG_FILE_PATH=/path/to/my-config.toml
```

### Strict Checking

Settings are checked when the server starts, so a typo does not silently fall back to a default:

- **Unknown sections or keys make a config file invalid.**
  - A file set via `MCP_CONFIG_FILE_PATH` stops the start, and the error lists every problem.
  - A file found automatically in the working directory is ignored instead: the problems are logged and the server starts without it. Such a file may belong to another program. A found file that contains `[auth]` or `[security]` stops the start, so a broken security setting never goes unnoticed.
- **Yes/no settings** accept `true`/`false`, `1`/`0`, `yes`/`no` or `on`/`off`. Anything else stops the start, and an empty value counts as not set.
- **Settings with fixed values** accept any upper or lower case: `LOG_LEVEL=INFO` works like `info`.

### Example Files

This directory contains complete reference configs with all available options documented:

| File | Description |
|------|-------------|
| [`example.config.toml`](./example.config.toml) | Full TOML reference (recommended) |
| [`example.config.yaml`](./example.config.yaml) | Full YAML reference |
| [`example.config.env`](./example.config.env) | Full environment variable reference |

Copy one of these as a starting point:

```bash
cp example.config.toml config.toml
# Edit config.toml with your settings
```

## Komodo Connection

These settings configure how the MCP server talks to Komodo Core. It's a single shared connection,
used for **stdio** (local, one user) and for **open HTTP mode** (authentication disabled). With
authentication enabled (the default for http/https), each user signs in with their **own** Komodo
account instead, and this shared connection isn't used for them - see
[MCP-Server Authentication](#mcp-server-authentication) below.

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `KOMODO_URL` | `komodo.url` | - | Komodo Core server URL (required) |
| `KOMODO_API_TIMEOUT_MS` | `komodo.api_timeout_ms` | `30s` | Komodo API request timeout (duration or ms) |

### Connection Credentials

Choose **one** of three credential methods for the connection:

#### API Key (Recommended)

Best for service accounts and automation. Can be rotated without changing user credentials.

| Variable | Config Key | Description |
|----------|-----------|-------------|
| `KOMODO_API_KEY` | `komodo.api_key` | API Key |
| `KOMODO_API_SECRET` | `komodo.api_secret` | API Secret |

#### Username / Password

For interactive users. Requires Komodo v2.0.0+.

| Variable | Config Key | Description |
|----------|-----------|-------------|
| `KOMODO_USERNAME` | `komodo.username` | Username |
| `KOMODO_PASSWORD` | `komodo.password` | Password |

#### JWT Token

For browser-based SSO (OIDC, GitHub, Google OAuth). Tokens expire - prefer API keys for persistent setups.

| Variable | Config Key | Description |
|----------|-----------|-------------|
| `KOMODO_JWT_TOKEN` | `komodo.jwt_token` | Pre-existing JWT token |

> **Tip:** Extract a JWT from your browser:  
> `JSON.parse(localStorage.getItem("komodo-auth-tokens-v1")).tokens[0].jwt`

### Credential Priority

When credentials are available from multiple sources, the highest-priority source wins:

```
Environment Variable  ->  Docker Secret File (*_FILE)  ->  Config File [komodo] section
```

### Docker Secrets

All credential variables support the Docker secrets pattern via `*_FILE` variants. The server reads the file contents at startup.

| Variable | Reads secret from file path |
|----------|---------------------------|
| `KOMODO_API_KEY_FILE` | API Key |
| `KOMODO_API_SECRET_FILE` | API Secret |
| `KOMODO_USERNAME_FILE` | Username |
| `KOMODO_PASSWORD_FILE` | Password |
| `KOMODO_JWT_TOKEN_FILE` | JWT Token |

**Example** (Docker Compose):

```yaml
services:
  komodo-mcp-server:
    image: ghcr.io/mp-tool/komodo-mcp-server:latest
    environment:
      KOMODO_URL: https://komodo.example.com:9120
      KOMODO_API_KEY_FILE: /run/secrets/komodo_api_key
      KOMODO_API_SECRET_FILE: /run/secrets/komodo_api_secret
    secrets:
      - komodo_api_key
      - komodo_api_secret

secrets:
  komodo_api_key:
    file: ./secrets/api_key.txt
  komodo_api_secret:
    file: ./secrets/api_secret.txt
```

> **Note:** Docker secret `*_FILE` variables are only supported as environment variables, not in config files.

## MCP-Server Authentication

Controls how **clients** authenticate to the MCP server - distinct from the Komodo connection
above. Only applies to `http`/`https`; `stdio` is local and never authenticated.

The rule behind every option: a caller presents a Komodo credential, the server asks Komodo whose
it is, and the session acts as **that Komodo user** - with that user's permissions and nothing
more. The MCP server never lends its own `[komodo]` credentials to a caller it cannot identify.

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `MCP_AUTH_ENABLED` | `auth.enabled` | `true` | Require clients to authenticate |
| `MCP_AUTH_API_KEY_HEADER` | `auth.api_key_header` | `false` | Also accept `X-Api-Key` / `X-Api-Secret` request headers |
| `MCP_AUTH_ACCESS_TOKEN_TTL` | `auth.access_token_ttl` | `1h` | Lifetime of issued access tokens |
| `MCP_AUTH_REFRESH_TOKEN_TTL` | `auth.refresh_token_ttl` | `30d` | How long an unused refresh token stays valid |
| `MCP_AUTH_SERVICE_CLIENT_ID` | `auth.clients.<id>` | - | Register one machine client (see below) |
| `MCP_AUTH_SERVICE_CLIENT_SECRET` | `auth.clients.<id>.secret` | - | Its secret, at least 32 characters |
| `MCP_AUTH_SERVICE_CLIENT_SECRET_FILE` | `auth.clients.<id>.secret_file` | - | ...or a file containing it (Docker secrets) |
| `MCP_AUTH_SERVICE_CLIENT_PUBLIC_KEY` | `auth.clients.<id>.public_key` | - | A public key instead of (or next to) the secret - see below |
| `MCP_AUTH_SERVICE_CLIENT_PUBLIC_KEY_FILE` | `auth.clients.<id>.public_key_file` | - | ...or a file containing it |
| `MCP_AUTH_SERVICE_CLIENT_SCOPES` | `auth.clients.<id>.scopes` | all | Limit what the client may do |
| `MCP_AUTH_OIDC_ISSUER` | `auth.providers.<name>.issuer` | - | Offer sign-in through your identity provider (see below) |
| `MCP_AUTH_OIDC_REDIRECT_HOST` | `auth.providers.<name>.redirect_host` | - | The provider's address for browsers, if different from the issuer |
| `MCP_AUTH_OIDC_CLIENT_ID` | `auth.providers.<name>.client_id` | - | The MCP server's client ID at that provider |
| `MCP_AUTH_OIDC_CLIENT_SECRET` | `auth.providers.<name>.client_secret` | - | Its client secret |
| `MCP_AUTH_OIDC_CLIENT_SECRET_FILE` | `auth.providers.<name>.secret_file` | - | ...or a file containing it (Docker secrets) |
| `MCP_AUTH_OIDC_NAME` | `auth.providers.<name>.display_name` | `OIDC` | Label of the button on the login page |
| `MCP_AUTH_OIDC_SCOPES` | `auth.providers.<name>.scopes` | `openid,email,profile` | What to request from the provider |
| `MCP_AUTH_CLIENT_METADATA` | `auth.client_metadata` | `true` | Let MCP clients introduce themselves by their web address ([details](#how-your-mcp-client-introduces-itself)) |
| `MCP_AUTH_CLIENT_METADATA_HOSTS` | `auth.client_metadata_hosts` | any | Accept such clients from these websites only, e.g. `claude.ai,vscode.dev` |
| `MCP_AUTH_DPOP` | `auth.dpop` | `true` | Let clients tie their token to a key of their own ([details](#tokens-tied-to-the-client-dpop)) |
| `MCP_AUTH_REQUIRED_SCOPES` | `auth.required_scopes` | - | Required scopes for `/mcp` (advanced) |
| `MCP_AUTH_REDIRECT_SCHEMES` | `auth.redirect_schemes` | - | Comma-separated app link schemes a client may return to after sign-in, beyond the ones that are always allowed (see below) |

> The RFC 9728 Protected Resource Metadata URL is derived automatically from the public base URL
> (`MCP_BASE_URL`) — there is no separate setting.

### Signing in with a browser

MCP clients that support OAuth (Claude, VS Code, Cursor, MCP Inspector, ...) open the server's login
page. It shows which client is asking and where you will be sent back to, and offers these ways to
sign in:

- **Password** - your Komodo username and password. Hidden automatically when Komodo itself has
  local login disabled.
- **API key** - a Komodo API key and secret (create one in the Komodo UI under your profile). Use
  this when your account signs in to Komodo through SSO, has two-factor authentication, or when you
  want the client to act as a dedicated service user. Keys created with Komodo 1.x (`K-...` /
  `S-...`) work just like the ones Komodo creates today (`K_..._K` / `S_..._S`).
- **Your identity provider** - a button for the provider you configured, when your Komodo can take
  such a sign-in over. See [Signing in through your identity provider](#signing-in-through-your-identity-provider).

The client then holds a short-lived access token plus a refresh token that is rotated on every use.
A password session ends when the Komodo login behind it expires (Komodo's `jwt_ttl`, one day by
default); an API-key session lasts as long as the key is valid and is re-checked against Komodo on
every refresh. Sessions are kept in memory, so clients sign in again after a server restart. For
the same reason, run **one** instance of the server per address: several replicas behind a load
balancer would not know each other's sign-ins.

**Where a client may return after sign-in:** to `https` addresses, to `http` on the same machine
(`localhost`, `127.0.0.1`, `[::1]`), and to app links in reverse-domain form such as
`com.example.app:/callback`. A desktop app with a short link scheme of its own needs that scheme in
`MCP_AUTH_REDIRECT_SCHEMES`, for example `MCP_AUTH_REDIRECT_SCHEMES=claude`. Other schemes are refused.

### How your MCP client introduces itself

Before the login page appears, the MCP client tells the server which application it is. There are
two ways. The client picks one; you do not have to configure anything.

- **By its web address.** Applications such as Claude Code and VS Code introduce themselves with an
  address on their maker's website. The MCP server downloads a short description from there - the
  application's name and where it may send you back to after signing in. The login page then shows
  the name together with the website it comes from, for example *Claude Code (identified by
  claude.ai)*. Nothing has to be registered, so a restart of the MCP server does not make the
  application a stranger again.
- **By registering.** Applications that do not have such an address register with the server, as
  before.

When the sign-in returns to an application on your own computer - the normal case for desktop
applications - the login page adds a note for applications that introduced themselves by a web
address: the server cannot verify that the application on your computer really is the one named.
Continue if you started the sign-in yourself; stop if a login page appears out of nowhere.

**The server needs outbound internet access for this**: it fetches the description over HTTPS from
the application's website. It only ever connects to public internet addresses, never follows a
redirect, and reads at most a few kilobytes.

- If your MCP server **cannot reach the internet**, set `MCP_AUTH_CLIENT_METADATA=false`.
  Otherwise applications that prefer their web address cannot sign in: the browser shows a short
  message that the server could not confirm the application, and the server's log names this
  setting. With the setting off, every application registers as before - also the ones that have
  already tried with their web address; you do not have to remove and re-add the server in them.
- To accept applications from **websites you name** only, list them:
  `MCP_AUTH_CLIENT_METADATA_HOSTS=claude.ai,vscode.dev` (`*.example.com` covers a domain and
  everything below it). Applications that register are not affected by this list.

### Signing in through your identity provider

If your Komodo signs people in through an OpenID Connect provider (Authentik, Keycloak, ...), the
MCP server can offer the same: a button on its login page takes you to the provider, and you come
back signed in as **your own Komodo user**, with your Komodo permissions.

> **This needs a Komodo Core that supports token exchange.** Komodo Core 2.3 and earlier do not:
> the MCP server then says at startup that sign-in through the provider cannot be offered, shows
> no button, and everything else keeps working. Until your Komodo supports it, sign in with an
> [API key](#signing-in-with-a-browser) - that works for every account.

How it works: you sign in at the provider, the MCP server hands the provider's proof of who you are
to Komodo, and Komodo answers with a session for the Komodo user linked to it. Komodo makes that
decision, not the MCP server - so three things have to be true on the Komodo side:

1. **Token exchange is enabled** in Komodo for that provider (see the Komodo documentation).
2. **Komodo accepts tokens issued to the MCP server.** Either add the MCP server's client ID to the
   audiences Komodo accepts for the provider, or let the MCP server use the same client as Komodo
   (see the note on Authentik below).
3. **You already have a Komodo account linked to the provider** - sign in to Komodo itself through
   it once - and that account is enabled. The MCP server never creates Komodo users.

Then set up the MCP server:

1. At the provider, register a client for the MCP server (or reuse Komodo's) and allow the redirect
   URI `<MCP_BASE_URL>/callback`, for example `https://mcp.example.com/callback`.
2. Tell the MCP server about it:

   ```bash
   MCP_AUTH_OIDC_ISSUER=https://sso.example.com/application/o/komodo/
   MCP_AUTH_OIDC_CLIENT_ID=komodo
   MCP_AUTH_OIDC_CLIENT_SECRET_FILE=/run/secrets/mcp_oidc_secret
   ```

   or, in the config file:

   ```toml
   [auth.providers.oidc]
   type = "oidc"
   issuer = "https://sso.example.com/application/o/komodo/"
   client_id = "komodo"
   secret_file = "/run/secrets/mcp_oidc_secret"
   ```

   The login page then has a **Continue with OIDC** button. `MCP_AUTH_OIDC_NAME` (or
   `display_name`) puts your provider's name on it instead.

**If the MCP server reaches the provider under another address than your browser does** - typical
when both run in the same Docker network - give both addresses, exactly as for Komodo itself
(`KOMODO_OIDC_PROVIDER` and `KOMODO_OIDC_REDIRECT_HOST`):

```bash
MCP_AUTH_OIDC_ISSUER=http://authentik:9000/application/o/komodo/   # how the MCP server reaches it
MCP_AUTH_OIDC_REDIRECT_HOST=https://sso.example.com                # how your browser reaches it (no path)
```

Good to know:

- **Signed in at the provider already?** Then the button takes you straight through - single
  sign-on. Otherwise the provider shows its own login first.
- **Authentik** gives every application its own issuer. Komodo recognises a sign-in by its issuer,
  so a separate Authentik application for the MCP server is not recognised. Use Komodo's own
  Authentik application for the MCP server too: same issuer, client ID and secret, with the MCP
  server's redirect URI added to it. Providers with one issuer for all applications (Keycloak,
  Entra ID, Okta, ...) can use a separate client.
- **Accounts with a second factor in Komodo** cannot complete it from here - use an API key.
- **If Komodo turns the sign-in down**, the login page tells you what to do next; the exact reason
  from Komodo is in the MCP server's log.
- **The session lasts as long as the Komodo session behind it** (Komodo's `jwt_ttl`, one day by
  default). After that you click the button again - if you are still signed in at the provider,
  that is all it takes.
- **Only OpenID Connect providers** (and Google) can be used. GitHub is not possible: it issues no
  signed proof of identity that Komodo could check.
- **The provider does not have to be running when the MCP server starts.** If it is not reachable
  at that moment, the button says so and works as soon as the provider is up - no restart needed.
- The provider's address must be HTTPS, unless it is `localhost` or you run the whole setup over
  [plain HTTP on a private network](#plain-http-on-private-networks).
- The API key sign-in, client credentials and API-key headers work next to it, unchanged.

### Without a browser: OAuth client credentials

For gateways, automation and any client that supports the OAuth `client_credentials` grant
(RFC 6749 §4.4, the MCP `oauth-client-credentials` extension). The client requests a token from
`POST /token` and uses it as a bearer token; nothing needs to be configured on the server beyond
`KOMODO_URL`.

**With a Komodo API key** - `client_id` is the API key, `client_secret` is the API secret:

```bash
curl -u 'K_...your key..._K:S_...your secret..._S' -d grant_type=client_credentials \
  https://mcp.example.com/token
```

The token acts as the Komodo user the key belongs to. Create a Komodo **service user** with exactly
the permissions the automation needs and give it its own key - the MCP tools it can see and use
follow from those permissions.

**With a registered client** - when the Komodo secret should not leave the server. The client gets
its own secret and acts as the `[komodo]` service account (`KOMODO_API_KEY` / `KOMODO_API_SECRET`):

```toml
[auth.clients.gateway]
secret_file = "/run/secrets/mcp_gateway_secret"   # or: secret = "..." (min. 32 characters)
scopes = ["komodo:read", "komodo:operate"]         # optional: limit what this client may do
```

```bash
curl -u 'gateway:<client secret>' -d grant_type=client_credentials https://mcp.example.com/token
```

`scopes` caps the client below the service account's own rights: `komodo:read` (read-only),
`komodo:operate` (lifecycle actions), `komodo:admin` (create/update/delete, exec). A client without
a usable secret or key, or registered while no `[komodo]` credentials are configured, is disabled at
startup with an error in the log. One client can also be set through the
`MCP_AUTH_SERVICE_CLIENT_*` environment variables.

**With a registered client and a key instead of a secret** - when no shared secret should exist at
all. The client keeps a private key and signs a short-lived request with it each time
(`private_key_jwt`); the server only ever holds the matching **public** key, which is useless to
anyone who reads it.

```bash
openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out gateway.key.pem   # stays with the client
openssl pkey -in gateway.key.pem -pubout -out gateway.pub.pem                          # goes to the server
```

```toml
[auth.clients.gateway]
public_key_file = "/run/secrets/mcp_gateway.pub.pem"   # or: public_key = "-----BEGIN PUBLIC KEY-----..."
scopes = ["komodo:read", "komodo:operate"]
```

Use it when your client supports "private key JWT" client authentication - the
[machine-client examples](../examples/machine-clients/#with-a-key-instead-of-a-secret) show it with
the MCP SDK. RSA keys (2048 bits or more) and Ed25519 keys work as well, and the key may be given
as a JWK. A client can have a secret and a key at the same time, which lets you move from one to the
other without downtime. If you put the *private* key into the server's configuration by mistake,
the client is disabled at startup and the log says so.

A client that no longer needs its token can give it back before it expires, with the same
credentials it got it with:

```bash
curl -u 'K_...your key..._K:S_...your secret..._S' -d "token=$TOKEN" https://mcp.example.com/revoke
```

Access tokens last `MCP_AUTH_ACCESS_TOKEN_TTL` (default one hour); clients simply request a new
one. The sign-in endpoints (`/token`, `/authorize`, `/register`) together accept 30 requests per
15 minutes per client address, so reuse a token until it expires instead of requesting one per
call.

### Without a browser: API-key headers (opt-in)

Some clients can neither run a browser login nor use `client_credentials`, but can send fixed
headers. For those, set `MCP_AUTH_API_KEY_HEADER=true` and send Komodo's own API-key headers with
every request:

```
X-Api-Key: K_...your key..._K
X-Api-Secret: S_...your secret..._S
```

The request acts as the key's Komodo user, exactly like the options above. This is off by default
because the long-lived secret sits in the client's configuration and travels with every request -
prefer `client_credentials` where the client supports it, and expose the endpoint over TLS or an
encrypted network only. An authenticating reverse proxy can inject the two headers so that clients
never hold the key.

An address that tries 20 different wrong keys or secrets within 15 minutes is locked out for the
rest of that window. The same wrong key sent again counts only once, so a client with an outdated
key does not lock out others behind the same address. A key that has worked before keeps working
during a lockout; a key that has not been used yet waits until the window ends.

### Tokens tied to the client (DPoP)

Normally whoever holds an access token can use it. Clients that support **DPoP** can instead have
their token tied to a key that never leaves them: the token then only works together with a fresh
signature from that key on every request, so a token that leaks - from a log, a proxy, a backup -
is worthless on its own.

There is nothing to configure. A client that asks for it gets such a token; every other client
works exactly as before. This applies to all the ways of signing in described above. The server
also hands such clients a fresh one-time value to include in their signatures, so that signatures
cannot be prepared in advance; DPoP clients handle that on their own.

One thing to know when the server sits **behind a reverse proxy**: these signatures are made for
the exact address the client calls. `MCP_BASE_URL` therefore has to be the address clients use, and
the proxy must pass the path on unchanged (`/mcp` stays `/mcp`). If your proxy rewrites the path
and a DPoP-capable client cannot connect, set `MCP_AUTH_DPOP=false` - clients then get ordinary
tokens.

### Plain HTTP on private networks

OAuth requires TLS. With authentication on, the server refuses to start when its public URL
(`MCP_BASE_URL`) is plain HTTP on anything but `localhost`. Options, in order of preference:

1. **Serve HTTPS** - `MCP_TRANSPORT=https` with a certificate, or a TLS-terminating reverse proxy,
   and set `MCP_BASE_URL=https://...`. On Tailscale, `tailscale serve` (or `tailscale cert`)
   provides a certificate for the machine's `*.ts.net` name.
2. **Accept plain HTTP explicitly** - if the network itself already encrypts the traffic
   (Tailscale, WireGuard), set `MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL=true`. The server then
   starts with a `SECURITY` warning. Credentials and tokens are only as safe as that network.
   This one setting must be a real environment variable of the server process (Docker
   `environment:` / `env_file:`, or your shell) - it has no config-file key and is not picked up
   from a `.env` file the server reads itself.

Whenever clients reach the server under another address than it binds to, set `MCP_BASE_URL` to
the address they use - sign-in links and OAuth metadata are built from it.

### Authentication off

**`MCP_AUTH_ENABLED=false` on a network transport:** the server runs **read-only** for anonymous
callers - write/exec/delete tools (including `komodo_exec`) are hidden from `tools/list` and
rejected on call. None of the options above is active in this mode, and no setting gives an
unauthenticated caller write access. `stdio` is unaffected (fully capable).

## Transport & Network

Controls how the MCP server communicates with clients.

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `MCP_TRANSPORT` | `transport.mode` | `stdio` | Transport mode: `stdio`, `http`, or `https` |
| `MCP_PORT` | `transport.port` | `8000` | HTTP/HTTPS listen port |
| `MCP_BIND_HOST` | `transport.host` | `127.0.0.1` | Bind address (`0.0.0.0` for all interfaces) |
| `MCP_BASE_URL` | `transport.base_url` | *(derived)* | Public URL behind a proxy/domain (OAuth redirects, metadata URL, trusted host) |
| `MCP_LEGACY_SSE_ENABLED` | `transport.sse_enabled` | `false` | Enable legacy SSE transport (protocol 2024-11-05) |
| `MCP_JSON_RESPONSE` | `transport.json_response` | `false` | Prefer JSON over SSE for non-streaming responses |
| `MCP_STATELESS` | `transport.stateless` | `false` | Stateless HTTP mode (no session IDs; `GET`/`DELETE` return 405) — for load-balanced/serverless setups |

### Transport Modes

| Mode | Use Case | Clients |
|------|----------|---------|
| **`stdio`** | Local CLI, single client | Claude Desktop, VS Code, npx |
| **`http`** | Network deployment, multi-client | Any MCP client over HTTP |
| **`https`** | Production with TLS termination | Any MCP client over HTTPS |

### TLS (HTTPS Mode)

Required when `MCP_TRANSPORT=https`:

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `MCP_TLS_CERT_PATH` | `transport.tls.cert_path` | - | TLS certificate file (PEM) |
| `MCP_TLS_KEY_PATH` | `transport.tls.key_path` | - | TLS private key file (PEM) |
| `MCP_TLS_CA_PATH` | `transport.tls.ca_path` | - | CA certificate (optional, for custom CA/mTLS) |

## Security

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `MCP_RATE_LIMIT_MAX` | `security.rate_limit_max` | `1000` | Max requests per rate limit window |
| `MCP_RATE_LIMIT_WINDOW_MS` | `security.rate_limit_window` | `15m` | Rate limit window (`"15m"`, `"1h"`, or ms) |
| `MCP_TRUST_PROXY` | `security.trust_proxy` | - | Trust proxy setting (for reverse proxies) |
| `MCP_BODY_SIZE_LIMIT` | `security.body_size_limit` | `1mb` | Max request body size |
| `MCP_ALLOWED_HOSTS` | `security.allowed_hosts` | - | DNS rebinding protection (comma-separated) |
| `MCP_CORS_ORIGIN` | `security.cors_origin` | - | CORS allowed origins (comma-separated, `*` for all) |
| `MCP_CORS_CREDENTIALS` | `security.cors_credentials` | `false` | Allow CORS credentials |
| `MCP_HELMET_HSTS` | `security.helmet_hsts` | `false` | Enable HSTS header |
| `MCP_HELMET_CSP` | `security.helmet_csp` | - | Content Security Policy |
| `MCP_HELMET_FRAME_OPTIONS` | `security.helmet_frame_options` | `DENY` | X-Frame-Options header |

### Destructive-Action Confirmation

Destructive tools (deletes, destroy, prune, exec, procedure/action/sync runs) ask the human
operator for approval via the MCP client's elicitation UI before executing.

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `MCP_CONFIRM_DESTRUCTIVE` | `tools.confirm_destructive` | `true` | Require manual confirmation for destructive tools |
| `MCP_CONFIRM_FALLBACK` | `tools.confirm_fallback` | `deny` | When the client cannot prompt (no elicitation support / stateless mode): `deny` refuses the call, `allow` executes with a warning |
| `MCP_CONFIRM_TIMEOUT_MS` | `tools.confirm_timeout` | `5m` | How long to wait for the confirmation answer (duration like `30s`/`5m`/`1h`, or ms) |

### Secret Redaction

The framework scrubs likely secrets out of **every** tool result at a central, fail-closed
boundary before it reaches the client transcript; offloaded resource links are scrubbed when they
are registered. This is a **best-effort, defence-in-depth** measure - key-name and value-shape
heuristics, not a guarantee.

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `MCP_SECRET_SCRUB_ENABLED` | `redaction.enabled` | `true` | Master switch for secret scrubbing of tool output |
| `MCP_SECRET_SCRUB_KEYS` | `redaction.keys` | - | Comma-separated extra key-name fragments to always redact (case-insensitive) |
| `MCP_SECRET_SCRUB_ALLOW_KEYS` | `redaction.allow_keys` | - | Comma-separated exact key names to never redact by key-matching (case-insensitive), merged with the built-in allowlist (`public_key`, `is_secret`, ...) |

The underlying server framework brings its own generic equivalents. They work here too, as the
**base layer** that the `MCP_SECRET_SCRUB_*` settings above extend:

| Variable | Relationship to the Komodo setting |
|----------|-----------------------------------|
| `MCP_SCRUB_ENABLED` | Base switch. `MCP_SECRET_SCRUB_ENABLED` overrides it when set; with neither set, redaction is **on**. |
| `MCP_SCRUB_ADDITIONAL_KEYS` | Combined with `MCP_SECRET_SCRUB_KEYS` - a key listed in either is redacted. |
| `MCP_SCRUB_ALLOW_KEYS` | Combined with `MCP_SECRET_SCRUB_ALLOW_KEYS` and the built-in allowlist. |

You only need one set. Use the `MCP_SECRET_SCRUB_*` names unless you are configuring several
framework-based servers from one shared environment.

**Coverage:** every tool result - structured resource config (env var blocks, `webhook_secret`,
`passkey`), alerter webhook URLs/emails, container inspect `Config.Env`, `komodo_exec` output,
container/build/update logs, and the sync-TOML export - inline payloads AND offloaded resource
links. Fail-closed: if scrubbing itself fails, the result is withheld rather than returned
unscrubbed. Komodo's domain rules are declared as policy and enforced by the same engine: secret
variables (`is_secret`) always have their value masked, alerter endpoint URLs/emails are masked by
path, and stacks' post-interpolation `deployed_config`/`deployed_contents` are removed entirely -
in structured payloads, rendered text, offloaded JSON and exported TOML alike.

> **The TOML export is redacted, so it is not directly re-appliable.** `komodo_toml_export_*`
> masks secret values, which means the exported file is meant for reading and diffing rather than
> for feeding straight back through ResourceSync. The `secrets_masked` field in the result reports
> whether redaction actually ran. Note that Komodo Core itself only masks variable values, and only
> for non-admin callers - server passkeys and alerter webhook URLs are never masked upstream, so
> switching redaction off means those leave the server in plaintext.

**Intended exception:** `komodo_user_create_api_key` returns its one-time secret unredacted -
that is the tool's purpose. The secret persists in the client transcript; rotate the key if the
transcript is untrusted.

**Limits:** runtime output (exec/logs) is scanned with the same heuristics - deterministic shapes
(tokenised URLs, JWTs, `KEY=value` pairs) are caught, but arbitrary secret material without a
recognizable shape is not. Don't rely on this feature as the only line of defence.

### Tool Surface

Limit which tools clients can use - to restrict what the assistant is allowed to do (e.g. read-only,
no terminal access) and to keep the tool list small (fewer tokens). Category values are the
`_meta.category` strings: `config`, `container`, `server`, `stack`, `deployment`, `build`, `repo`,
`procedure`, `action`, `alerter`, `swarm`, `resource_sync`, `variable`, `update`, `terminal`, `user`.

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `MCP_TOOLS_ALLOWED_CATEGORIES` | `tools.allowed_categories` | *(all)* | Allow only these categories. Unset = all allowed |
| `MCP_TOOLS_EXCLUDED_CATEGORIES` | `tools.excluded_categories` | - | Remove whole categories |
| `MCP_TOOLS_EXCLUDED_TOOLS` | `tools.excluded_tools` | - | Remove individual tools by name (e.g. `komodo_exec`) |

These only **remove** tools (allowlist first, then the excludes) - removed tools are absent from
`tools/list` and not callable. They never add tools or bypass authentication. An unknown category is
ignored with a startup warning; a misspelled tool name simply has no effect.

## Resources

Large tool outputs (logs, inspect data) are offloaded to session-scoped `ephemeral://...` resource
links, fetched out-of-band via `resources/read`, so they don't bloat the tool result inline.

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `MCP_RESOURCE_TTL_INFO` | `resources.ttl_info` | `15m` | TTL for info/inspect resources (duration or ms) |
| `MCP_RESOURCE_TTL_LOGS` | `resources.ttl_logs` | `2m` | TTL for log resources (duration or ms) |
| `MCP_RESOURCE_MAX_ENTRIES` | `resources.max_entries` | `1000` | Max ephemeral entries kept in memory (oldest evicted first) |

## Sessions

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `MCP_MAX_SESSIONS` | `session.max_sessions` | `200` | Max total concurrent sessions |
| `MCP_MAX_SESSIONS_PER_PRINCIPAL` | `session.max_sessions_per_principal` | `50` | Max concurrent sessions of one signed-in user; more are refused with `429`. Raise it when many clients share one account |
| `MCP_MAX_STREAMABLE_HTTP_SESSIONS` | `session.max_streamable_http_sessions` | *(`MCP_MAX_SESSIONS`)* | Max Streamable HTTP sessions |
| `MCP_MAX_SSE_SESSIONS` | `session.max_sse_sessions` | `50` | Max legacy SSE sessions |

## Logging

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `LOG_LEVEL` | `logging.level` | `info` | Log level: `error`, `warn`, `info`, `debug`, `trace` |
| `LOG_FORMAT` | `logging.format` | `text` | Output format: `text` or `json` (ECS-compatible) |
| `LOG_TIMESTAMP` | `logging.timestamp` | `false` | Include timestamps in text output |
| `LOG_COMPONENT` | `logging.component` | `false` | Include component name in text output |
| `LOG_DIR` | `logging.log_dir` | - | Directory for file logging (disabled if unset) |
| `LOG_MAX_FILE_SIZE` | `logging.max_file_size` | `10mb` | Max log file size before rotation |
| `LOG_MAX_FILES` | `logging.max_files` | `3` | Max rotated log files to keep (not the audit log) |
| `LOG_RETENTION_DAYS` | `logging.retention_days` | `0` | Delete log files older than N days (0 = disabled; not the audit log) |
| `LOG_AUDIT_FILE` | `logging.audit_file` | `<logs>/audit.log` | Path to the JSON-Lines audit-log file (always on). The server never deletes audit files: remove old ones yourself |
| `LOG_AUDIT_TOOL_IO` | `logging.audit_tool_io` | `summary` | Audit request/result depth per tool call (scrubbed): `off`, `summary`, `full` |

## Telemetry (Experimental)

OpenTelemetry integration for distributed tracing and metrics. Zero overhead when disabled.

| Variable | Config Key | Default | Description |
|----------|-----------|---------|-------------|
| `OTEL_ENABLED` | `telemetry.enabled` | `false` | Master toggle for all OTEL features |
| `OTEL_SERVICE_NAME` | `telemetry.service_name` | Server name | Service name for traces/metrics |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `telemetry.exporter_endpoint` | - | OTLP endpoint (e.g. `http://jaeger:4318`) |
| `OTEL_TRACES_EXPORTER` | `telemetry.traces_exporter` | `none` | Trace exporter: `otlp`, `console`, `none` |
| `OTEL_LOGS_EXPORTER` | `telemetry.logs_exporter` | `none` | Log exporter: `otlp`, `console`, `none` |
| `OTEL_METRICS_EXPORTER` | `telemetry.metrics_exporter` | `prometheus` | Metric exporter: `otlp`, `prometheus`, `console`, `none` |
| `OTEL_METRIC_EXPORT_INTERVAL` | `telemetry.metric_export_interval` | SDK default | Metric push interval (ms) |
| `OTEL_LOG_LEVEL` | `telemetry.log_level` | `none` | SDK diagnostic log level |

## Config File Sections

The config file is organized into sections that map to the tables above:

```toml
[komodo]              # Komodo Core connection & credentials (KOMODO_*)
[auth]                # MCP-server authentication (MCP_AUTH_*)
[transport]           # Transport mode, port, host
[transport.tls]       # TLS certificates (HTTPS mode)
[security]            # Rate limiting, CORS, Helmet, DNS rebinding
[tools]               # Tool surface + destructive-action confirmation (MCP_TOOLS_* / MCP_CONFIRM_*)
[redaction]           # Secret redaction of tool output (MCP_SECRET_SCRUB_*)
[resources]           # Ephemeral resource registry (MCP_RESOURCE_*)
[session]             # Session limits
[logging]             # Log level, format, file output
[telemetry]           # OpenTelemetry configuration
```

See [`example.config.toml`](./example.config.toml) for a complete reference with all fields documented.

## More Info

- [Main Documentation](../README.md)
- [Docker Deployment](../docker/README.md)
- [Client Integrations](../examples/README.md)
