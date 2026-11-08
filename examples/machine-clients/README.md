# Machine Clients

Connecting to a remote Komodo MCP Server over HTTP **without a browser login** - for MCP gateways,
automation, and clients that run where nobody can click through a sign-in page.

The idea is the same in every variant: the client presents a Komodo credential, and the MCP server
lets it do exactly what that credential may do in Komodo. For anything automated, create a Komodo
**service user**, give it only the permissions it needs, and create an API key for it
(Komodo UI -> Settings -> Users -> the service user -> API keys). The tools the client sees follow
from those permissions: a read-only service user gets read tools only.

| Your client can... | Use | Server setup |
|--------------------|-----|--------------|
| do OAuth client credentials | [Option 1](#option-1-oauth-client-credentials-with-a-komodo-api-key) | none beyond `KOMODO_URL` |
| do OAuth client credentials, and the Komodo secret must stay on the server | [Option 2](#option-2-a-registered-client) | register the client (with a secret, or [with a key](#with-a-key-instead-of-a-secret)) |
| only send fixed headers | [Option 3](#option-3-api-key-headers) | `MCP_AUTH_API_KEY_HEADER=true` |
| only do the browser login | sign in once with the **API key** tab of the login page | none |

All examples assume the server is reachable at `https://mcp.example.com`. OAuth requires HTTPS;
for Tailscale/WireGuard setups see
[Plain HTTP on private networks](../../config/README.md#plain-http-on-private-networks).

## Option 1: OAuth client credentials with a Komodo API key

`client_id` is the API key, `client_secret` is the API secret. Nothing to configure on the server.

**Any client or gateway with "OAuth client credentials" support** - enter:

| Field | Value |
|-------|-------|
| Token URL | `https://mcp.example.com/token` |
| Client ID | `K_..._K` (the Komodo API key) |
| Client secret | `S_..._S` (the Komodo API secret) |
| Scope | leave empty, or `komodo:read` to request a read-only token |

Clients that discover the endpoints themselves only need the MCP URL
(`https://mcp.example.com/mcp`) plus client ID and secret.

**curl**

```bash
TOKEN=$(curl -s -u "$KOMODO_API_KEY:$KOMODO_API_SECRET" \
  -d grant_type=client_credentials https://mcp.example.com/token | jq -r .access_token)

curl -s https://mcp.example.com/mcp \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"curl","version":"1.0"}}}'
```

**MCP TypeScript SDK**

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ClientCredentialsProvider } from "@modelcontextprotocol/sdk/client/auth-extensions.js";

const transport = new StreamableHTTPClientTransport(new URL("https://mcp.example.com/mcp"), {
  authProvider: new ClientCredentialsProvider({
    clientId: process.env.KOMODO_API_KEY!,
    clientSecret: process.env.KOMODO_API_SECRET!,
  }),
});

const client = new Client({ name: "my-automation", version: "1.0.0" }, { capabilities: {} });
await client.connect(transport); // fetches and renews the token on its own
console.log((await client.listTools()).tools.map((tool) => tool.name));
```

The access token is valid for one hour; clients request a new one when it expires. Reuse the token
in between - the sign-in endpoints are rate limited. A token that is no longer needed can be given
back early: `curl -u "$KOMODO_API_KEY:$KOMODO_API_SECRET" -d "token=$TOKEN" https://mcp.example.com/revoke`.

## Option 2: A registered client

Use this when the Komodo credential should stay on the MCP server: the server keeps
`KOMODO_API_KEY` / `KOMODO_API_SECRET` of a service user, and each client gets a secret of its own
that can be limited and revoked without touching Komodo.

Server (`config.toml`):

```toml
[komodo]
url = "https://komodo.example.com:9120"
# KOMODO_API_KEY / KOMODO_API_SECRET of the service user - via environment or Docker secrets

[auth.clients.gateway]
secret_file = "/run/secrets/mcp_gateway_secret"   # at least 32 characters
scopes = ["komodo:read", "komodo:operate"]         # optional limit
```

or with environment variables only:

```dotenv
KOMODO_URL=https://komodo.example.com:9120
KOMODO_API_KEY_FILE=/run/secrets/komodo_api_key
KOMODO_API_SECRET_FILE=/run/secrets/komodo_api_secret
MCP_AUTH_SERVICE_CLIENT_ID=gateway
MCP_AUTH_SERVICE_CLIENT_SECRET_FILE=/run/secrets/mcp_gateway_secret
```

Generate a secret with `openssl rand -hex 32`. The client then uses client ID `gateway` and that
secret exactly as in Option 1.

### With a key instead of a secret

If no shared secret should exist at all, give the client a key pair. The client keeps the private
key and signs each token request with it; the server only gets the public key, which nobody can
sign in with.

```bash
openssl genpkey -algorithm EC -pkeyopt ec_paramgen_curve:P-256 -out gateway.key.pem   # stays with the client
openssl pkey -in gateway.key.pem -pubout -out gateway.pub.pem                          # goes to the server
```

Server:

```toml
[auth.clients.gateway]
public_key_file = "/run/secrets/mcp_gateway.pub.pem"
scopes = ["komodo:read", "komodo:operate"]
```

or `MCP_AUTH_SERVICE_CLIENT_ID=gateway` with
`MCP_AUTH_SERVICE_CLIENT_PUBLIC_KEY_FILE=/run/secrets/mcp_gateway.pub.pem`.

Client (**MCP TypeScript SDK**):

```typescript
import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { PrivateKeyJwtProvider } from "@modelcontextprotocol/sdk/client/auth-extensions.js";

const transport = new StreamableHTTPClientTransport(new URL("https://mcp.example.com/mcp"), {
  authProvider: new PrivateKeyJwtProvider({
    clientId: "gateway",
    privateKey: readFileSync("gateway.key.pem", "utf-8"),
    algorithm: "ES256",
  }),
});

const client = new Client({ name: "my-gateway", version: "1.0.0" }, { capabilities: {} });
await client.connect(transport);
```

In other clients and gateways the setting is usually called "private key JWT" or
`private_key_jwt`; the audience to configure, if asked, is the server's address with a trailing
slash (`https://mcp.example.com/`).

## Option 3: API-key headers

For clients that cannot do OAuth client credentials but can send fixed headers. Switch it on at
the server:

```dotenv
MCP_AUTH_API_KEY_HEADER=true
```

and send Komodo's API-key headers with every request.

**VS Code** (`mcp.json`) - the inputs keep the key out of the file:

```json
{
  "inputs": [
    { "id": "komodoKey", "type": "promptString", "description": "Komodo API key" },
    { "id": "komodoSecret", "type": "promptString", "description": "Komodo API secret", "password": true }
  ],
  "servers": {
    "komodo": {
      "type": "http",
      "url": "https://mcp.example.com/mcp",
      "headers": {
        "X-Api-Key": "${input:komodoKey}",
        "X-Api-Secret": "${input:komodoSecret}"
      }
    }
  }
}
```

**Claude Code**

```bash
claude mcp add --transport http komodo https://mcp.example.com/mcp \
  --header "X-Api-Key: $KOMODO_API_KEY" --header "X-Api-Secret: $KOMODO_API_SECRET"
```

**Reverse proxy** - let the proxy that already authenticates your users add the headers, so
clients never hold the Komodo key (Caddy):

```caddyfile
mcp.example.com {
  # ...your authentication here...
  reverse_proxy komodo-mcp:8000 {
    header_up X-Api-Key {env.KOMODO_API_KEY}
    header_up X-Api-Secret {env.KOMODO_API_SECRET}
  }
}
```

With a proxy in front, also set `MCP_TRUST_PROXY` on the server (see the
[Configuration Guide](../../config/README.md)).

This option is off by default because the long-lived secret sits in the client configuration and
travels with every request. Prefer Options 1 and 2 where the client supports them, and never
expose the endpoint over unencrypted connections.

## What a client can do

Whatever its Komodo user can. The MCP server groups its tools into three tiers and shows a client
only the tiers its Komodo permissions cover:

| Scope | Tools | Komodo permission needed |
|-------|-------|--------------------------|
| `komodo:read` | list, info, logs, stats | Read on at least one resource |
| `komodo:operate` | start, stop, deploy, restart, ... | Execute |
| `komodo:admin` | create, update, delete, `komodo_exec` | Write, or Komodo admin |

Each call is additionally checked against the user's permission on the specific resource, and
Komodo enforces its own rules on top. A client can ask for less with the `scope` parameter, and a
registered client can be capped with `scopes`.
