# Multi-stage build for Komodo MCP server
FROM node:22-alpine AS builder

# Upgrade OS packages and install build dependencies
RUN apk upgrade --no-cache && apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install all dependencies (including devDependencies for TypeScript)
RUN npm ci

# Copy source code
COPY . .

# Build the project
RUN npm run build

# Production stage
FROM node:22-alpine AS production

# Upgrade OS packages to fix vulnerabilities
RUN apk upgrade --no-cache

# Set working directory  
WORKDIR /app

# Copy package.json
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && npm cache clean --force

# Copy built project from builder stage
COPY --from=builder /app/build ./build

# Create non-root user
RUN addgroup -g 1001 -S komodo && \
    adduser -S komodo -u 1001

# Switch to non-root user
USER komodo

# Build arguments
ARG VERSION

# Environment variables
ENV NODE_ENV=production
ENV VERSION=${VERSION}

# Health check - verifies MCP server process is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD pgrep -f "node.*build/index.js" > /dev/null || exit 1

# Container metadata labels (OCI standard)
LABEL org.opencontainers.image.title="Komodo MCP Server"
LABEL org.opencontainers.image.version="${VERSION}"
LABEL org.opencontainers.image.source=https://github.com/mp-tool/komodo-mcp-server
LABEL org.opencontainers.image.description="Komodo MCP Server - Model Context Protocol Server for Komodo"
LABEL org.opencontainers.image.licenses=GPL-3.0
LABEL org.opencontainers.image.authors="Marcel Pfennig"
LABEL org.opencontainers.image.vendor="MP-Tool"

# Default: Start as MCP Server
CMD ["node", "build/index.js"]
