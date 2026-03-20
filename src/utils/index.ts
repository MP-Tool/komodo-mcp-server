/**
 * App Utils Module
 *
 * Application-specific utility exports.
 *
 * ## Migration Note (v1.2.0)
 *
 * Logger, Errors, and RequestManager have been moved to their canonical locations.
 * Import directly from:
 *
 * - Framework: `import { logger, ... } from './framework.js'`
 * - App Errors: `import { ... } from './errors/index.js'`
 *
 * This file now only exports application-specific utilities.
 *
 * @module app/utils
 */

// Response formatter exports (app-specific utilities)
export {
  formatActionResponse,
  formatListHeader,
  formatInfoResponse,
  formatErrorResponse,
  formatLogsResponse,
  formatSearchResponse,
  formatPruneResponse,
  type ActionType,
  type ResourceType,
  type ActionResponseOptions,
  type ListResponseOptions,
  type InfoResponseOptions,
  type ErrorResponseOptions,
  type LogsResponseOptions,
  type SearchResponseOptions,
  type PruneResponseOptions,
} from './response-formatter.js';
