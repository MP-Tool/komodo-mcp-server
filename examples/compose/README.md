# Docker Compose Deployment

Deploy the Komodo MCP Server using Docker Compose for production or development environments with proper resource management and health checks.

## Quick Setup

**1. Copy environment file:**

```bash
cp .env.example .env
```

**2. Configure credentials:**

Edit `.env` and set your Komodo connection details:

```env
KOMODO_URL=https://your-komodo-server.com:9120
KOMODO_USERNAME=your-username
KOMODO_PASSWORD=your-password
```

**3. Start the server:**

```bash
docker compose up -d
```

**4. Verify it's running:**

```bash
docker compose ps
docker compose logs komodo-mcp-server
```

**5. Connect your MCP client:**

The server is now running and ready to accept MCP connections via stdio.

## Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `KOMODO_URL` | Komodo server URL | Yes | - |
| `KOMODO_USERNAME` | Komodo username | Yes | - |
| `KOMODO_PASSWORD` | Komodo password | Yes | - |
| `NODE_ENV` | Runtime environment | No | `production` |

**Example `.env`:**
```env
KOMODO_URL=https://komodo.example.com:9120
KOMODO_USERNAME=admin
KOMODO_PASSWORD=secret-password
NODE_ENV=production
```

### Resource Limits

Default limits in [`compose.yaml`](./compose.yaml):

- **Memory:** 256MB limit, 128MB reservation
- **CPU:** 0.25 cores (25%)

Adjust for your workload:

```yaml
deploy:
  resources:
    limits:
      memory: 512M      # Increase if needed
      cpus: '0.5'       # More CPU for heavy usage
    reservations:
      memory: 256M
```

### Network Configuration

**Default: Host Mode**

Uses host networking for simplicity:

```yaml
network_mode: host
```

**Production: Bridge Mode**

For remote Komodo or better isolation:

```yaml
services:
  komodo-mcp-server:
    # Remove: network_mode: host
    networks:
      - komodo-network
    ports:
      - "9120:9120"    # If exposing ports

networks:
  komodo-network:
    driver: bridge
```

### Health Check

Built-in health check monitors the MCP process:

```yaml
healthcheck:
  test: ["CMD", "pgrep", "-f", "node.*build/index.js"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 10s
```

## Usage

### Connecting MCP Clients

**Docker Exec Method:**

```json
{
  "mcpServers": {
    "komodo-mcp-server": {
      "command": "docker",
      "args": ["exec", "-i", "komodo-mcp-server", "node", "build/index.js"]
    }
  }
}
```

**Standalone Container:**

For Claude Desktop or VS Code, use the standalone image instead (see [claude](../claude/) or [vscode](../vscode/) examples).

### Management Commands

```bash
# Start server
docker compose up -d

# Stop server
docker compose down

# View logs
docker compose logs -f

# Restart server
docker compose restart

# Check status
docker compose ps

# View resource usage
docker stats komodo-mcp-server
```

### Updating

```bash
# Pull latest image
docker compose pull

# Restart with new image
docker compose up -d
```

## Troubleshooting

### Container not starting

**Solution:**
```bash
# Check logs for errors
docker compose logs komodo-mcp-server

# Verify environment variables
docker compose config

# Test without detached mode
docker compose up
```

### Health check failing

**Solution:**
- Check if MCP server process is running
- Verify resource limits aren't too restrictive
- Increase memory if needed
- Check logs for startup errors

### Cannot connect to Komodo

**Solution:**
- Verify `KOMODO_URL` is correct and reachable
- Test connection: `curl -k ${KOMODO_URL}/health`
- Check firewall/network access from Docker
- Verify credentials are correct

### Resource issues

**Solution:**
```bash
# Check resource usage
docker stats komodo-mcp-server

# Increase limits in compose.yaml
# Then recreate
docker compose up -d --force-recreate
```

### Permission errors

**Solution:**
- Ensure Docker daemon is running
- Check user has Docker permissions
- Verify `.env` file permissions (should be readable)

## More Info

- [Main Documentation](../../README.md)
- [All Examples](../README.md)

## Additional Resources

- [Komodo](https://komo.do)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Model Context Protocol Specification](https://modelcontextprotocol.io)

## License

GPL-3.0 - see [LICENSE](../../LICENSE) for details.

---

**Made with ❤️ for the Komodo community**
