/**
 * Centralized Schema Descriptions
 *
 * Reusable descriptions for Zod schema fields, response icons, and constants.
 *
 * @module config/descriptions
 */

// ============================================================================
// Response Icons
// ============================================================================

export const RESPONSE_ICONS = {
  SUCCESS: "✅",
  ERROR: "❌",
  WARNING: "⚠️",
  START: "🚀",
  STOP: "⏹️",
  RESTART: "🔄",
  PAUSE: "⏸️",
  UNPAUSE: "▶️",
  RESUME: "▶️",
  DELETE: "🗑️",
  PRUNE: "🧹",
  DEPLOY: "📤",
  PULL: "📥",
  CREATE: "✨",
  UPDATE: "📝",
  CONTAINER: "📦",
  SERVER: "🖥️",
  STACK: "📚",
  DEPLOYMENT: "🚢",
  INFO: "ℹ️",
  LIST: "📋",
  NETWORK: "🌐",
  TIME: "⚡",
  AUTH: "🔐",
  VERSION: "📦",
} as const;

// ============================================================================
// Parameter Descriptions
// ============================================================================

export const PARAM_DESCRIPTIONS = {
  SERVER_ID: "Server ID or name",
  SERVER_ID_REQUIRED: "Server ID or name (required)",
  SERVER_ID_OPTIONAL: "Server ID or name (optional)",
  SERVER_ID_FOR_STATS: "Server ID or name to get stats for",
  SERVER_ID_FOR_COMPOSE: "Server ID or name for Compose mode deployment",
  SERVER_ID_FOR_DEPLOY: "Server ID or name to deploy on (required unless using swarm_id)",
  SERVER_ID_WHERE_CONTAINER_RUNS: "Server ID or name where the container is running",
  SERVER_ID_TO_LIST_CONTAINERS: "Server ID or name to list containers from",
  CONTAINER_ID: "Container name or ID",
  CONTAINER_ID_FOR_ACTION: "Container name or ID to perform the action on",
  CONTAINER_ID_FOR_INSPECT: "Container name or ID to inspect",
  CONTAINER_ID_FOR_LOGS: "Container name or ID to get logs from",
  CONTAINER_ID_FOR_SEARCH: "Container name or ID to search logs from",
  DEPLOYMENT_ID: "Deployment ID or name",
  DEPLOYMENT_ID_FOR_INFO: "Deployment ID or name to get info for",
  DEPLOYMENT_ID_FOR_UPDATE: "Deployment ID or name to update",
  STACK_ID: "Stack ID or name",
  STACK_ID_FOR_INFO: "Stack ID or name to get info for",
  STACK_ID_FOR_UPDATE: "Stack ID or name to update",
  SWARM_ID: "Swarm ID for Docker Swarm mode deployment",
  SWARM_ID_FOR_DEPLOY: "Swarm ID to deploy on (required unless using server_id)",
  SERVER_NAME: "Unique name for the server",
  DEPLOYMENT_NAME: "Unique name for the deployment",
  STACK_NAME: "Unique name for the stack",
} as const;

// ============================================================================
// Config Descriptions
// ============================================================================

export const CONFIG_DESCRIPTIONS = {
  SERVER_CONFIG_PARTIAL: "Server configuration fields to update (partial update)",
  SERVER_CONFIG_CREATE: "Server configuration (all fields optional)",
  DEPLOYMENT_CONFIG_PARTIAL: "Deployment configuration fields to update (partial update)",
  DEPLOYMENT_CONFIG_CREATE: "Full deployment configuration (optional)",
  STACK_CONFIG_PARTIAL: "Stack configuration fields to update (partial update)",
  STACK_CONFIG_CREATE: "Full stack configuration",
} as const;

// ============================================================================
// Log Descriptions
// ============================================================================

export const LOG_DESCRIPTIONS = {
  TAIL_LINES: (defaultValue: number) => `Number of lines to show from the end of logs. Default: ${defaultValue}`,
  TAIL_LINES_FOR_SEARCH: (defaultValue: number) =>
    `Number of lines to retrieve before filtering. Default: ${defaultValue}`,
  TIMESTAMPS: (defaultValue: boolean) => `Show timestamps in log output. Default: ${defaultValue}`,
  SEARCH_QUERY: "Search query or pattern to filter logs (plain text, not regex)",
  CASE_SENSITIVE: (defaultValue: boolean) => `Perform case-sensitive search. Default: ${defaultValue}`,
} as const;

// ============================================================================
// Field Descriptions
// ============================================================================

export const FIELD_DESCRIPTIONS = {
  NETWORK: 'Docker network to connect to. Use "host" for host networking or specify a custom network name.',
  NETWORK_DEFAULT_HOST: 'Docker network (default: "host"). Examples: "bridge", "host", "my-custom-network"',
  ENVIRONMENT:
    'Environment variables as newline-separated KEY=value pairs. Example: "DB_HOST=localhost\\nDB_PORT=5432"',
  VOLUMES:
    'Volume mappings as newline-separated /host:/container pairs. Example: "/data:/app/data\\n/config:/app/config"',
  PORTS: 'Port mappings as newline-separated host:container pairs. Example: "8080:80\\n443:443"',
  LABELS: 'Docker labels as newline-separated key=value pairs. Example: "traefik.enable=true\\napp.version=1.0"',
  EXTRA_ARGS: "Additional command-line arguments to pass to Docker",
  IMAGE_SIMPLE: 'Docker image to deploy. Examples: "nginx:latest", "ghcr.io/owner/repo:v1.0"',
  FILE_CONTENTS: "Docker Compose YAML content. Define services, networks, and volumes for the stack.",
  GIT_REPO: "Git repository name (without owner)",
  GIT_BRANCH: "Git branch to clone. Default: default branch of repository",
  GIT_COMMIT: "Specific commit hash to checkout. Default: latest commit on branch",
} as const;

// ============================================================================
// Domain-Specific Descriptions
// ============================================================================

export const RESTART_MODE_DESCRIPTIONS = {
  NO: "Do not automatically restart",
  ON_FAILURE: "Restart only if the container exits with a non-zero exit code",
  ALWAYS: "Always restart the container regardless of exit status",
  UNLESS_STOPPED: "Always restart unless manually stopped",
} as const;

export const PRUNE_TARGET_DESCRIPTIONS = {
  CONTAINERS: "Remove all stopped containers",
  IMAGES: "Remove unused images (dangling and unreferenced)",
  VOLUMES: "Remove all unused local volumes",
  NETWORKS: "Remove all unused networks",
  SYSTEM: "Run docker system prune (containers, networks, images)",
  ALL: "Prune all resource types",
} as const;

export const ALERT_DESCRIPTIONS = {
  SEND_UNREACHABLE: "Whether to send alerts about server reachability",
  SEND_CPU: "Whether to send alerts about CPU status",
  SEND_MEM: "Whether to send alerts about memory status",
  SEND_DISK: "Whether to send alerts about disk status",
  SEND_VERSION_MISMATCH: "Whether to send alerts about version mismatch with core",
  SEND_ALERTS_DEPLOYMENT: "Whether to send alerts for this deployment. Default: false",
} as const;

export const THRESHOLD_DESCRIPTIONS = {
  CPU_WARNING: "Percentage threshold which triggers WARNING state for CPU (0-100)",
  CPU_CRITICAL: "Percentage threshold which triggers CRITICAL state for CPU (0-100)",
  MEM_WARNING: "Percentage threshold which triggers WARNING state for memory (0-100)",
  MEM_CRITICAL: "Percentage threshold which triggers CRITICAL state for memory (0-100)",
  DISK_WARNING: "Percentage threshold which triggers WARNING state for disk (0-100)",
  DISK_CRITICAL: "Percentage threshold which triggers CRITICAL state for disk (0-100)",
} as const;
