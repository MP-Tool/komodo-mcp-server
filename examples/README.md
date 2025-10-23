# Integration Examples

Ready-to-use configurations for integrating the Komodo MCP Server with various platforms and tools.

## 🚀 Quick Start Guide

Choose your preferred integration method below. Each example includes complete setup instructions and configuration files.

---

## Available Integrations

### 1. [Claude Desktop](./claude/) 
**Best for:** AI-assisted container management through conversations

Direct MCP integration with Claude Desktop. Manage your Komodo infrastructure through natural language conversations.

**Difficulty:** Easy

**Quick start:**
```bash
# Copy config, update credentials, restart Claude
```

**Use cases:**
- Interactive container management
- AI-guided troubleshooting
- Natural language queries
- Learning Komodo operations

---

### 2. [VS Code](./vscode/)
**Best for:** Developer workflows and IDE integration

GitHub Copilot Chat integration for VS Code. Access Komodo tools directly from your development environment.

**Difficulty:** Easy

**Quick start:**
```bash
# Copy mcp.json to ~/.vscode/mcp/ or .vscode/
```

**Use cases:**
- Development workflows
- Quick container checks
- Deployment from IDE
- Context-aware assistance

---

### 3. [Docker Compose](./compose/)
**Best for:** Production deployments and self-hosted setups

Standalone deployment using Docker Compose with health checks, resource limits, and environment management.

**Difficulty:** Easy

**Quick start:**
```bash
cd compose/
cp .env.example .env
# Edit .env with credentials
docker compose up -d
```

**Use cases:**
- Production deployments
- Self-hosted MCP servers
- Custom automation scripts
- Integration testing

---

### 4. [Docker Desktop](./docker-desktop/)
**Best for:** Docker Desktop AI assistant users

Native MCP integration for Docker Desktop 4.34+ beta. Use Komodo tools directly in Docker Desktop's AI assistant.

**Difficulty:** Medium (Beta feature)

**Quick start:**
```bash
# Copy catalog, configure registry, restart Docker Desktop
```

**Use cases:**
- Unified Docker + Komodo UI
- Docker-centric workflows
- Testing beta features
- Local development

---

## 📊 Feature Comparison

| Feature | Claude | VS Code | Compose | Docker Desktop |
|---------|--------|---------|---------|----------------|
| **Ease of Setup** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **AI Integration** | ✅ Native | ✅ Copilot | ❌ | ✅ Native |
| **IDE Integration** | ❌ | ✅ | ❌ | ❌ |
| **Production Ready** | ✅ | ✅ | ✅✅ | ⚠️ Beta |
| **Self-Hosted** | ❌ | ❌ | ✅ | ❌ |
| **Update Method** | Docker Pull | Docker Pull | Compose Pull | Docker Pull |

---

## 🎯 Which Integration Should I Choose?

### I want AI assistance...
- **For conversations:** → [Claude Desktop](./claude/)
- **In my IDE:** → [VS Code](./vscode/)
- **In Docker Desktop:** → [Docker Desktop](./docker-desktop/)

### I want to deploy...
- **For production:** → [Docker Compose](./compose/)
- **For development:** → [VS Code](./vscode/) or [Claude Desktop](./claude/)
- **For testing:** → Any of them!

### I want to integrate with...
- **Claude Desktop:** → [Claude Desktop](./claude/)
- **GitHub Copilot:** → [VS Code](./vscode/)
- **Custom tools:** → [Docker Compose](./compose/)
- **Docker Desktop:** → [Docker Desktop](./docker-desktop/)

---

## 🔧 Common Setup

All integrations require:

1. **Komodo Server** running and accessible
2. **Credentials** (URL, username, password)
3. **Network Access** from your machine to Komodo

### Komodo Connection Details

You'll need:
```
KOMODO_URL=https://your-komodo-server.com:9120
KOMODO_USERNAME=your-username
KOMODO_PASSWORD=your-password
```

Get these from your Komodo administrator or server setup.

---

## 🛠️ Troubleshooting

### General Issues

**Cannot connect to Komodo:**
- Verify server URL is correct (include protocol: `https://` or `http://`)
- Check firewall/network access
- Test connection: `curl -k $KOMODO_URL/health`

**Authentication fails:**
- Ensure Komodo v1.19.5+ for username/password auth
- Verify credentials are correct
- Check user has proper permissions

**Docker image issues:**
- Pull latest: `docker pull ghcr.io/mp-tool/komodo-mcp-server:latest`
- Verify: `docker images | grep komodo-mcp-server`

### Integration-Specific

Each integration folder has detailed troubleshooting in its README:
- [Claude Troubleshooting](./claude/README.md#troubleshooting)
- [VS Code Troubleshooting](./vscode/README.md#troubleshooting)
- [Compose Troubleshooting](./compose/README.md#troubleshooting)
- [Docker Desktop Troubleshooting](./docker-desktop/README.md#troubleshooting)

---

## 🧪 Testing Your Setup

After setup, verify it works:

**1. List servers:**
```
Ask: "List all Komodo servers"
Expected: List of your configured servers
```

**2. List containers:**
```
Ask: "Show containers on [server-name]"
Expected: List of containers on that server
```

**3. Get server stats:**
```
Ask: "Get stats for [server-name]"
Expected: CPU, memory, disk usage
```

---

## 📚 Additional Resources

### Documentation
- [Main README](../README.md) - Project documentation
- [Contributing Guide](../CONTRIBUTING.md) - How to contribute
- [Release Process](../RELEASE.md) - Version management

### External Links
- [Komodo Container Manager](https://komo.do) - Official Komodo site
- [MCP Specification](https://modelcontextprotocol.io) - Protocol details
- [GitHub Repository](https://github.com/MP-Tool/komodo-mcp-server) - Source code

---

## 🤝 Need Help?

- 📖 Read integration-specific READMEs
- 🐛 [Report Issues](https://github.com/MP-Tool/komodo-mcp-server/issues)
- 💬 [Join Discussions](https://github.com/MP-Tool/komodo-mcp-server/discussions)
- 📧 Check Komodo documentation at [komo.do](https://komo.do)

---

**Ready to get started? Pick an integration above and follow its README!** 🚀
