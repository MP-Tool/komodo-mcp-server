# =============================================================================
# Multi-stage build for Komodo MCP Server
# =============================================================================
# Supported architectures: linux/amd64, linux/arm64, linux/arm/v7
# 
# Build strategy for multi-arch:
# - All npm operations happen in builder stage (avoids QEMU issues)
# - Production stage only copies pre-built artifacts
# - This prevents "Illegal instruction" crashes on ARM64 cross-compilation
#
# Security:
# - Runtime uses built-in node user (UID 1000) with nologin shell
# - Build artifacts owned by root (immutable for runtime user)
# - Tini as init system for proper signal handling
# =============================================================================

# Build arguments for metadata (passed from CI/docker build)
ARG VERSION=unknown
ARG BUILD_DATE=unknown
ARG COMMIT_SHA=unknown

# Use native platform for builder (avoids QEMU emulation issues with npm)
FROM --platform=$BUILDPLATFORM node:22-alpine AS builder

# Upgrade OS packages
RUN apk upgrade --no-cache 

WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install all dependencies (including devDependencies for TypeScript build)
RUN npm ci

# Copy only necessary source files for build (optimizes layer caching)
COPY tsconfig*.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build:prod

# Prune devDependencies - runs on native platform (no QEMU), so npm works fine
RUN npm prune --omit=dev && npm cache clean --force

# =============================================================================
# Development stage (for DevContainer)
# =============================================================================
# Used for local development with DevContainers.
# Source files are NOT copied — the devcontainer mounts the workspace as a volume.
# Dependencies are pre-installed and preserved in an anonymous volume (/app/node_modules).

FROM node:22-alpine AS development

# Install development tools and tini for proper signal handling
RUN apk upgrade --no-cache && \
    apk add --no-cache git zsh tini && \
    mkdir -p /app && chown node:node /app

WORKDIR /app
USER node

# Pre-install dependencies (preserved in anonymous volume by devcontainer).
# Runs as node user so node_modules has correct ownership for postCreateCommand.
COPY --chown=node:node package*.json ./
RUN npm ci

# Environment variables for development
ENV NODE_ENV=development
ENV MCP_BIND_HOST=0.0.0.0
ENV MCP_PORT=8000
ENV MCP_TRANSPORT=http

EXPOSE 8000

# Use tini for proper signal handling (consistent with production)
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "run", "dev"]

# =============================================================================
# Production stage
# =============================================================================

FROM node:22-alpine AS production

# Re-declare ARGs for this stage (needed for LABELs)
ARG VERSION
ARG BUILD_DATE
ARG COMMIT_SHA

# Upgrade OS packages and install tini for proper signal handling
RUN apk upgrade --no-cache && \
    apk add --no-cache tini

WORKDIR /app

# Copy build artifacts as root-owned (immutable for runtime user)
# Runtime user (node) cannot modify these files
COPY --from=builder --chown=root:root /app/node_modules ./node_modules
COPY --from=builder --chown=root:root /app/build ./build
COPY --from=builder --chown=root:root /app/package.json ./package.json

# Harden the built-in node user:
# - Change shell to nologin (no interactive login possible)
# - This is a service account only for running the application
RUN sed -i 's|/home/node:/bin/sh|/home/node:/sbin/nologin|' /etc/passwd

# Switch to non-root user (built-in node user, UID 1000)
USER node

# Environment variables
ENV NODE_ENV=production
ENV MCP_TRANSPORT=http
ENV MCP_BIND_HOST=0.0.0.0
ENV MCP_PORT=8000

# Expose MCP port
EXPOSE ${MCP_PORT}

# Health check - verifies MCP server is ready to accept traffic (HTTP/HTTPS mode only)
# In stdio mode, health check is skipped (always healthy)
# Uses /ready endpoint for comprehensive status:
# - 200: Server ready (process running, Komodo connected if configured)
# - 503: Komodo configured but not connected
# - 429: Session limits reached
# Uses Node.js built-in fetch() — no extra tools (wget/curl) needed
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD if [ "$MCP_TRANSPORT" = "http" ] || [ "$MCP_TRANSPORT" = "https" ]; then \
    node -e "fetch('http://localhost:'+(process.env.MCP_PORT||8000)+'/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; \
  else exit 0; fi

# Container metadata labels (OCI standard)
LABEL org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${COMMIT_SHA}" \
      org.opencontainers.image.title="Komodo MCP Server" \
      org.opencontainers.image.description="Model Context Protocol server for Komodo Container Manager" \
      org.opencontainers.image.source="https://github.com/mp-tool/komodo-mcp-server" \
      org.opencontainers.image.documentation="https://github.com/mp-tool/komodo-mcp-server#readme" \
      org.opencontainers.image.licenses="GPL-3.0" \
      org.opencontainers.image.authors="Marcel Pfennig" \
      org.opencontainers.image.vendor="MP-Tool" \
      io.modelcontextprotocol.server.name="io.github.MP-Tool/komodo-mcp-server"

# Use tini as init system for proper signal handling (SIGTERM, SIGINT)
# This ensures graceful shutdown and prevents zombie processes
ENTRYPOINT ["/sbin/tini", "--"]

# Start MCP Server
CMD ["node", "build/index.js"]
