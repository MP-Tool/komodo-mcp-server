<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Komodo MCP Server

A Model Context Protocol (MCP) server that enables AI assistants and automation tools to interact with [Komodo Container Manager](https://komo.do) for Docker container management, server orchestration, and deployment operations.

## General Programming Instructions

### Code Quality Principles
- Write **readable, clean, efficient, maintainable, and well-structured** code.
- Follow the **DRY (Don't Repeat Yourself)** principle.
- Use **descriptive names** for variables, functions, classes, and other identifiers.
- Write **modular code** using the **Clean Architecture** pattern (Transport -> Controller -> Service).
- Follow **Single Responsibility Principle (SRP)** - each function/class should have one clear purpose.
- Apply **Separation of Concerns** and **divide and conquer** strategies.
- Include **comments and documentation** to explain complex logic and MCP tool behaviors.
- Follow **best practices and coding standards** for TypeScript and Node.js.
- Ensure code is **scalable and adaptable** to accommodate future enhancements.

### TypeScript Best Practices
- Use **TypeScript Strict Mode** for maximum type safety.
- Define clear interfaces for all Komodo API types (`KomodoContainer`, `KomodoServer`, etc.).
- Use **Zod schemas** for strict runtime validation of tool inputs and environment variables.
- Leverage strong typing for MCP SDK request/response handlers.
- Use proper error handling with typed error objects.

### Architecture & Patterns
- **Modular Structure**: Organize code by domain (`api`, `tools`, `transport`, `config`).
- **Tool Pattern**: All tools must implement a strict `Tool` interface with `name`, `description`, `schema`, and `handler`.
- **Transport Layer**: Support **Dual Mode** transport:
  - **Stdio**: For local CLI usage (default).
  - **Streamable HTTP (SSE)**: For network/Docker usage (via Express).
- **Configuration**: Centralized configuration with Zod validation in `src/config`.

## Project Overview

### Core Technology Stack
- **MCP Server**: TypeScript/Node.js with `@modelcontextprotocol/sdk`.
- **Transport**: Stdio (CLI) and Express (SSE/HTTP).
- **API Client**: Axios-based Komodo API client.
- **Schema Validation**: Zod for request/response validation.
- **Container Platform**: Docker with multi-stage builds (Node 22-alpine, Non-Root User).
- **License**: GPL-3.0.

### Project Structure (Target)
```
komodo-mcp-server/
├── src/
│   ├── api/            # Komodo API Client (Axios)
│   ├── config/         # Configuration & Env Validation
│   ├── tools/          # Tool Definitions (The "Controllers")
│   │   ├── base.ts     # Abstract Tool Class/Interface
│   │   ├── container/  # Container Tools
│   │   ├── stack/      # Stack Tools
│   │   └── ...
│   ├── transport/      # MCP Transport Layer (Stdio & SSE)
│   ├── utils/          # Helpers
│   └── index.ts        # Entry Point
├── build/              # Compiled JavaScript output
├── examples/           # Integration examples
├── Dockerfile          # Multi-stage production build (Non-Root)
├── compose.yaml        # Development Docker Compose
├── package.json        # NPM configuration
├── tsconfig.json       # TypeScript configuration
├── README.md           # Project documentation
└── LICENSE             # GPL-3.0 license
```

## Komodo Container Manager Integration

### About Komodo
Komodo is an open-source container management platform similar to Portainer, with focus on:
- **Docker Container Management**: Start, stop, restart, pause, unpause operations.
- **Server Orchestration**: Multi-server management with Periphery agents.
- **Docker Compose Stacks**: Full stack lifecycle management.
- **Deployments**: Automated container deployments.

### Komodo API Architecture
- **Core API**: REST API on Core server (default port 9121).
- **Authentication**: Hybrid approach (Session + API Key support).
- **API Endpoints**: 
  - `/user/login` - Authentication
  - `/read/*` - Query operations (GET)
  - `/execute/*` - Action operations (POST)
- **API Types**: Typed TypeScript interfaces for all entities.

## MCP Server Implementation

### Tool Implementation Guidelines
- Each tool should be a separate file/module in `src/tools/<category>/`.
- Tools must be registered in a central `ToolRegistry`.
- Input schemas must be defined using Zod.
- Handlers should use the `KomodoClient` from `src/api`.

### Available Tools (Planned)
1. **Configuration & Health**: `komodo_configure`, `komodo_health_check`
2. **Container Management**: `list`, `start`, `stop`, `pause`, `unpause`, `inspect`, `logs`
3. **Server Management**: `list_servers`, `get_server_stats`
4. **Stack Management**: `list_stacks`, `stop_stack`, `start_stack`
5. **Deployment Management**: `list_deployments`, `deploy_container`

### Error Handling Strategy
- **Validation**: Zod schemas throw clear validation errors.
- **API Errors**: Komodo API errors wrapped in `McpError` with context.
- **Transport Errors**: Handle connection drops and reconnections gracefully (especially for SSE).
- **Error Codes**: Use MCP ErrorCode enum (InvalidRequest, InternalError, MethodNotFound).

## Development Workflow

### Build & Run
```bash
npm run build         # Compile TypeScript
npm run dev          # Build and run locally
npm run start        # Run compiled code
npm run clean        # Remove build artifacts
```

### Docker Development
- Use `docker compose up` for development.
- Ensure the container runs as a **non-root user** for security.
- Health checks should verify the `/health` endpoint in SSE mode.

## Security Considerations
- **Credentials**: Never commit `.env` files or credentials.
- **Authentication**: JWT tokens have expiration, handle renewal.
- **Container Isolation**: Run MCP server with minimal privileges (Non-Root).
- **Input Validation**: All tool inputs validated with Zod schemas.
