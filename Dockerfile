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

FROM node:22-alpine AS builder

# Upgrade OS packages and install build dependencies
# python3, make, g++ are required for native Node.js modules (e.g., on ARM)
RUN apk upgrade --no-cache && \
    apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install all dependencies (including devDependencies for TypeScript build)
RUN npm ci

# Copy only necessary source files for build (optimizes layer caching)
COPY tsconfig*.json ./
COPY src/ ./src/

# Re-declare ARGs after FROM (they don't persist across stages)
ARG VERSION
ARG BUILD_DATE
ARG COMMIT_SHA

# Build TypeScript and embed build metadata
RUN npm run build && \
    echo "${VERSION}" > build/VERSION && \
    echo "${BUILD_DATE}" > build/BUILD_DATE && \
    echo "${COMMIT_SHA}" > build/COMMIT_SHA

# Prune devDependencies - keeps only production deps
# CRITICAL: This must happen in builder stage to avoid QEMU emulation issues
# Running npm in production stage under QEMU causes "Illegal instruction" on ARM64
RUN npm prune --omit=dev && npm cache clean --force

# =============================================================================
# Development stage (for DevContainer)
# =============================================================================

# Used for local development with hot-reload and debugging capabilities
FROM node:22-alpine AS development

# Upgrade OS packages and install development tools
RUN apk upgrade --no-cache && apk add --no-cache git zsh curl

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

# Copy source files
COPY . .

# Use node user for security
USER node

# Build arguments
ARG VERSION

# Environment variables for development
ENV NODE_ENV=development
ENV VERSION=${VERSION}
ENV MCP_BIND_HOST=0.0.0.0
ENV MCP_PORT=3000
ENV MCP_TRANSPORT=http

# Development command with live rebuild
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

# Harden the built-in node user:
# - Change shell to nologin (no interactive login possible)
# - This is a service account only for running the application
RUN sed -i 's|/home/node:/bin/sh|/home/node:/sbin/nologin|' /etc/passwd

# Switch to non-root user (built-in node user, UID 1000)
USER node

# Environment variables
ENV NODE_ENV=production
ENV MCP_BIND_HOST=0.0.0.0
ENV MCP_PORT=3000
ENV MCP_TRANSPORT=http

# Expose MCP port
EXPOSE ${MCP_PORT}

# Health check - verifies MCP server is ready to accept traffic
# Uses /ready endpoint for comprehensive status:
# - 200: Server ready (process running, Komodo connected if configured)
# - 503: Komodo configured but not connected
# - 429: Session limits reached
# wget --spider: HEAD request only, -q: quiet mode
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --spider -q http://localhost:${MCP_PORT}/ready || exit 1

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
      org.opencontainers.image.vendor="MP-Tool"

# Use tini as init system for proper signal handling (SIGTERM, SIGINT)
# This ensures graceful shutdown and prevents zombie processes
ENTRYPOINT ["/sbin/tini", "--"]

# Start MCP Server
CMD ["node", "build/index.js"]
