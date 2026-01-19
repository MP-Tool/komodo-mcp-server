# =============================================================================
# Multi-stage build for Komodo MCP Server
# =============================================================================
# Supported architectures: linux/amd64, linux/arm64, linux/arm/v7
# 
# Build strategy for multi-arch:
# - All npm operations happen in builder stage (avoids QEMU issues)
# - Production stage only copies pre-built artifacts
# - This prevents "Illegal instruction" crashes on ARM64 cross-compilation
# =============================================================================

FROM node:24-alpine AS builder

# Upgrade OS packages and install build dependencies
# python3, make, g++ are required for native Node.js modules (e.g., on ARM)
RUN apk upgrade --no-cache && apk add --no-cache python3 make g++ curl

WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install all dependencies (including devDependencies for TypeScript build)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Extract version from package.json and write to version file
# This "bakes in" the version at build time - immutable once built
RUN node -p "require('./package.json').version" > build/VERSION

# Prune devDependencies - keeps only production deps
# CRITICAL: This must happen in builder stage to avoid QEMU emulation issues
# Running npm in production stage under QEMU causes "Illegal instruction" on ARM64
RUN npm prune --omit=dev && npm cache clean --force

# =============================================================================
# Development stage (for DevContainer)
# =============================================================================

# Used for local development with hot-reload and debugging capabilities
FROM node:24-alpine AS development

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

FROM node:24-alpine AS production

# Upgrade OS packages to fix vulnerabilities
RUN apk upgrade --no-cache

WORKDIR /app

# Copy package.json
COPY package*.json ./

# Copy pre-pruned node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy built JavaScript from builder stage
COPY --from=builder /app/build ./build

# Create non-root user for security
RUN addgroup -g 1001 -S komodo && \
    adduser -S komodo -u 1001

# Switch to non-root user
USER komodo

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
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${MCP_PORT}/ready || exit 1

# Container metadata labels (OCI standard)
LABEL org.opencontainers.image.title="Komodo MCP Server"
LABEL org.opencontainers.image.source=https://github.com/mp-tool/komodo-mcp-server
LABEL org.opencontainers.image.description="Komodo MCP Server - Model Context Protocol Server for Komodo"
LABEL org.opencontainers.image.licenses=GPL-3.0
LABEL org.opencontainers.image.authors="Marcel Pfennig"
LABEL org.opencontainers.image.vendor="MP-Tool"

# Default: Start as MCP Server
CMD ["node", "build/index.js"]
