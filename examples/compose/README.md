# Self-Hosting with Docker Compose

Run the Komodo MCP Server as a persistent service using Docker Compose. This is ideal for long-running environments or when running alongside Komodo.

## 🚀 Quick Start

### 1. Prepare Directory
Create a folder and download the necessary files:
- [`compose.yaml`](./compose.yaml)
- [`.env.example`](./.env.example)

### 2. Configure Environment
Rename `.env.example` to `.env` and edit it with your credentials:

```bash
mv .env.example .env
# Edit the file with your preferred editor
nano .env
```

**Required settings:**
```dotenv
KOMODO_URL=https://your-komodo-server.com:9120
KOMODO_USERNAME=your-username
KOMODO_PASSWORD=your-password
```

### 3. Start Server
Launch the service in the background:

```bash
docker compose up -d
```

## 🔌 Connecting Clients

### Claude Desktop
Claude Desktop requires the server to be managed directly via `stdio`.
👉 **Please use the [Claude Desktop Guide](../claude/README.md)** for the correct setup.

### Other MCP Clients (SSE)
For clients that support remote connections via Server-Sent Events (SSE) (e.g. generic MCP inspectors or other tools):

1.  **Start Server:**
    ```bash
    docker compose up -d
    ```

2.  **Connect:**
    Configure your client to connect to:
    `http://localhost:3000/mcp`

## More Info
- [Main Documentation](../../README.md)
- [Komodo](https://komo.do)
