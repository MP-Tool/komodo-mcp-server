# Security Policy

## Reporting a Vulnerability

I take the security of this project seriously. If you discover a security vulnerability, please do not report it in the public issue tracker.

Instead, please use **GitHub's Private Vulnerability Reporting**:
1. Go to the **Security** tab of this repository.
2. Click on **"Report a vulnerability"**.
3. Fill out the details to privately disclose the issue to the maintainers.

If this feature is not available, you can reach out via [GitHub Discussions](https://github.com/MP-Tool/komodo-mcp-server/discussions) to request a private communication channel.

I'll respond as soon as possible.

## Supported Versions

I release security updates for the latest version (main branch) only. Please keep your installation up to date.

## Security Best Practices

- **Never commit credentials** or `.env` files.
- **Use dedicated Komodo users** with minimal permissions - for automation, a Komodo service user
  with its own API key.
- **Serve the MCP endpoint over HTTPS**, or only inside a network that encrypts traffic.
- **Run containers as non-root** (default in our setup).
- **Use HTTPS** for Komodo connections.

## Security Measures

**In the server (runtime):**

- **Authentication on by default** for HTTP/HTTPS - every caller presents a Komodo credential
  (username/password or API key in the browser, OAuth client credentials, or the opt-in API-key
  headers) and acts as that Komodo user with that user's permissions, never more.
- **Open servers are read-only**: if you disable authentication on a network transport, only read
  tools are available - write, delete and terminal tools are hidden and refused. No setting gives
  a caller without a credential write access.
- **The server's own Komodo credentials are not lent out**: they serve stdio and the read-only
  open mode. A caller always signs in with a Komodo credential of its own.
- **Tokens are the server's own**: opaque, stored only as digests, bound to the requesting client
  and to this server, with refresh tokens rotated on every use. A session belongs to the caller
  that opened it.
- **Per-resource permission checks** run before every action, enforced against the user's Komodo
  permissions.
- **Confirmation for destructive actions** (delete, destroy, prune, terminal commands, and
  procedure/action/sync runs), fail-closed.
- **Secret redaction** removes secrets from tool output at a central, fail-closed boundary before it
  reaches the client or the model.
- **Transport hardening**: `MCP-Protocol-Version` and `Host` header validation (DNS-rebinding
  protection), rate limiting, and Zod input validation.

**In development & release:**

- **SAST**: CodeQL analysis on every pull request.
- **Dependency review**: automated checks for vulnerable dependencies.
- **Container hardening**: regularly updated base images; containers run as a non-root user.

See the [configuration reference](config/README.md) for how these behave and how to configure them.

---

For questions, see [GitHub Discussions](https://github.com/MP-Tool/komodo-mcp-server/discussions).
