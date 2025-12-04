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

We implement the following security measures in our development and release process:

- **SAST Scanning**: CodeQL analysis runs on every pull request.
- **Dependency Review**: Automated checks for vulnerable dependencies in PRs.
- **Container Hardening**:
  - Base images are regularly updated in build process.
  - Containers run as a non-root user.
- **Transport Security**:
  - Strict `MCP-Protocol-Version` header validation.
  - `Host` header validation to prevent DNS rebinding.
  - Rate limiting on API endpoints.
  - Input validation using Zod schemas.

---

For questions, see [GitHub Discussions](https://github.com/MP-Tool/komodo-mcp-server/discussions).
