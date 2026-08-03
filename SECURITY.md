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
- **Use dedicated Komodo users** with minimal permissions.
- **Run containers as non-root** (default in our setup).
- **Use HTTPS** for Komodo connections.

## Security Measures

**In the server (runtime):**

- **Authentication on by default** for HTTP/HTTPS - each user signs in and acts as their own Komodo
  identity with their own permissions, never a shared account.
- **Open servers are read-only**: if you disable authentication on a network transport, only read
  tools are available - write, delete and terminal tools are hidden and refused.
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
