<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Komodo MCP Server

A Model Context Protocol (MCP) server that enables AI assistants and automation tools to interact with [Komodo Container Manager](https://komo.do) for Docker container management, server orchestration, and deployment operations.

## General Programming Instructions

### Code Quality Principles
- Write **readable, clean, efficient, maintainable, and well-structured** code
- Follow the **DRY (Don't Repeat Yourself)** principle to avoid code redundancy
- Use **descriptive names** for variables, functions, classes, and other identifiers
- Write **modular code** by breaking down complex problems into smaller, manageable functions or classes
- Follow **Single Responsibility Principle (SRP)** - each function/class should have one clear purpose
- Apply **Separation of Concerns** and **divide and conquer** strategies
- Include **comments and documentation** to explain complex logic and MCP tool behaviors
- Follow **best practices and coding standards** for TypeScript and Node.js
- Ensure code is **scalable and adaptable** to accommodate future enhancements
- Keep code **simple and concise** - avoid over-engineering

### TypeScript Best Practices
- Use **TypeScript** for type safety and improved code quality
- Define clear interfaces for Komodo API types (`KomodoContainer`, `KomodoServer`, etc.)
- Use **Zod schemas** for runtime validation of tool inputs
- Leverage strong typing for MCP SDK request/response handlers
- Use proper error handling with typed error objects

### Debugging & Development
- Use **VS Code problems panel** (`vscode.problems`) to identify and fix issues - not just console logs
- Test MCP tools individually before integration
- Validate Komodo API responses match expected types
- Use console.error for MCP server logging (stdout is reserved for MCP protocol)

## Project Overview

### Core Technology Stack
- **MCP Server**: TypeScript/Node.js with `@modelcontextprotocol/sdk` v1.18.0
- **API Client**: Axios-based Komodo API client with JWT authentication
- **Schema Validation**: Zod for request/response validation
- **Container Platform**: Docker with multi-stage builds (Node 22-alpine)
- **License**: GPL-3.0

### Project Structure
```
komodo-mcp-server/
├── src/
│   ├── index.ts              # Main MCP server with 13 tools
│   └── komodo-client.ts      # Type-safe Komodo API client
├── build/                    # Compiled JavaScript output
├── examples/                 # Integration examples
│   ├── claude/              # Claude Desktop configuration
│   ├── vscode/              # VS Code Copilot integration
│   ├── compose/             # Docker Compose deployment
│   ├── docker-desktop/      # Docker Desktop MCP beta
│   └── n8n/                 # n8n automation workflows
├── Dockerfile               # Multi-stage production build
├── compose.yaml            # Development Docker Compose
├── komodo-mcp-catalog.yaml  # Docker Desktop discovery catalog
├── package.json            # NPM configuration
├── tsconfig.json           # TypeScript configuration
├── README.md               # Project documentation
├── SECURITY.md             # Security policy
└── LICENSE                 # GPL-3.0 license
```

## Komodo Container Manager Integration

### About Komodo
Komodo is an open-source container management platform similar to Portainer, with focus on:
- **Docker Container Management**: Start, stop, restart, pause, unpause operations
- **Server Orchestration**: Multi-server management with Periphery agents
- **Docker Compose Stacks**: Full stack lifecycle management
- **Deployments**: Automated container deployments
- **Build System**: CI/CD integration for image builds
- **Granular Permissions**: Role-based access control

### Komodo API Architecture
- **Core API**: REST API on Core server (default port 9121)
- **Periphery Agents**: Lightweight agents on managed servers (port 8120)
- **Authentication**: Username/password login returns JWT token (Komodo v1.19.5+)
- **API Endpoints**: 
  - `/user/login` - Authentication
  - `/read/*` - Query operations (GET)
  - `/execute/*` - Action operations (POST)
- **API Types**: Typed TypeScript interfaces for all entities

## MCP Server Implementation

### Available Tools (13 Total)

#### Configuration & Health
1. **komodo_configure** - Configure connection with username and password
   - Required before other operations
   - Returns health check status after authentication
   - Inputs: `url`, `username`, `password`

2. **komodo_health_check** - Verify connection and diagnostics
   - Tests API connectivity
   - Returns response time and API version
   - No inputs required

#### Container Management (5 tools)
3. **komodo_list_containers** - List all containers on a server
   - Input: `server` (ID or name)
   
4. **komodo_start_container** - Start a container
   - Inputs: `server`, `container`
   
5. **komodo_stop_container** - Stop a container
   - Inputs: `server`, `container`
   
6. **komodo_pause_container** - Pause a running container
   - Inputs: `server`, `container`
   
7. **komodo_unpause_container** - Unpause a paused container
   - Inputs: `server`, `container`

#### Server Management (2 tools)
8. **komodo_list_servers** - List all managed servers
   - No inputs required
   
9. **komodo_get_server_stats** - Get server statistics and status
   - Input: `server` (ID or name)
   - Returns: CPU, memory, disk, network stats

#### Deployment Management (2 tools)
10. **komodo_list_deployments** - List all deployments
    - No inputs required
    
11. **komodo_deploy_container** - Trigger container deployment
    - Input: `deployment` (ID or name)

#### Stack Management (2 tools)
12. **komodo_list_stacks** - List all Docker Compose stacks
    - No inputs required
    
13. **komodo_stop_stack** - Stop a Docker Compose stack
    - Input: `stack` (ID or name)

### MCP Server Architecture
- **Server Class**: `KomodoMCPServer` manages MCP lifecycle
- **Transport**: StdioServerTransport for MCP communication
- **Tool Handlers**: Each tool has dedicated handler method
- **Error Handling**: McpError for protocol-compliant errors
- **Client Management**: Single KomodoClient instance per server
- **Validation**: Zod schemas validate all tool inputs

### Error Handling Strategy
- **Configuration Check**: All tools (except configure/health) require configured client
- **Validation**: Zod schemas throw clear validation errors
- **API Errors**: Komodo API errors wrapped in McpError with context
- **Error Codes**: Use MCP ErrorCode enum (InvalidRequest, InternalError, MethodNotFound)

## Integration Examples

### Claude Desktop
- Docker mode recommended (using ghcr.io image)
- Configuration in `~/Library/Application Support/Claude/claude_desktop_config.json`
- Environment variables passed via config

### VS Code Copilot
- Global: `~/.vscode/mcp/mcp.json`
- Workspace: `.vscode/mcp.json`
- Supports both Node.js and Docker modes

### Docker Compose
- Production: Use `ghcr.io/mp-tool/komodo-mcp-server:latest`
- Environment variables in `.env` file
- Resource limits: 256M RAM, 0.25 CPU

### Docker Desktop (Beta)
- MCP discovery via `komodo-mcp-catalog.yaml`
- Manual registration in `registry.yaml`
- Beta feature requires Docker Desktop latest

### n8n Automation
- Example workflows in `examples/n8n/`
- Container monitoring and auto-restart
- Deployment pipelines
- Server health alerts

## Docker Implementation

### Multi-Stage Build
```dockerfile
# Stage 1: Builder (compile TypeScript)
FROM node:22-alpine AS builder
# Install build dependencies, compile TypeScript

# Stage 2: Production (runtime)
FROM node:22-alpine
# Copy built files, minimal runtime
```

### Health Check
- Command: `pgrep -f "node.*build/index.js"`
- Verifies MCP process is running
- Interval: 30s, Timeout: 10s, Retries: 3

### OCI Labels (Komodo Standard)
- `org.opencontainers.image.source` - GitHub repository URL
- `org.opencontainers.image.description` - Short description
- `org.opencontainers.image.licenses` - GPL-3.0
- `org.opencontainers.image.authors` - Marcel Pfennig
- `org.opencontainers.image.vendor` - MP-Tool

## Development Workflow

### Build & Run
```bash
npm run build         # Compile TypeScript
npm run dev          # Build and run locally
npm run start        # Run compiled code
npm run clean        # Remove build artifacts
```

### Docker Development
```bash
docker compose build  # Build image
docker compose up -d  # Start container
docker compose logs   # View MCP logs
```

### Testing Tools
- Configure first: `komodo_configure`
- Test health: `komodo_health_check`
- List resources: `komodo_list_servers`, `komodo_list_containers`
- Test actions: Start/stop containers

## Security Considerations

- **Credentials**: Never commit `.env` files or credentials
- **Authentication**: JWT tokens have expiration, handle renewal
- **API Access**: Requires proper Komodo user permissions
- **Container Isolation**: Run MCP server with minimal privileges
- **HTTPS**: Use HTTPS for Komodo API connections when possible
- **Input Validation**: All tool inputs validated with Zod schemas

## Contributing Guidelines

- Follow code quality principles outlined above
- Test MCP tools with real Komodo instance
- Update tool descriptions and schemas for any changes
- Document new features in README and examples
- Use TypeScript strict mode
- Write clear commit messages
- Update copilot-instructions.md for significant changes

## Documentation Standards

- **Code Comments**: Explain "why" not "what" for complex logic
- **Tool Descriptions**: Clear, concise, action-oriented
- **Type Definitions**: Document all Komodo API interfaces
- **Examples**: Provide working examples for each integration
- **README**: Keep main README updated with features and quick start
- **SECURITY.md**: Document security best practices and reporting

## Future Enhancements (Potential)

- Extended monitoring features (real-time metrics)
- Build management integration (trigger builds)
- Repository/Git integration (deploy from Git)
- WebSocket support for real-time updates
- Batch operations (start/stop multiple containers)
- Stack deployment (in addition to stop)
- Server resource management (prune operations)
