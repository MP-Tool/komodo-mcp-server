/**
 * Shared Input Validation Schemas
 *
 * Cross-domain validators for resource IDs and names.
 * Used by container, server, deployment, and stack tools.
 *
 * @module tools/schemas/validators
 */

import { z } from "mcp-server-framework";
import { VALIDATION_LIMITS } from "../../config/index.js";

/** Validates server ID format (MongoDB ObjectId or human-readable name) */
export const serverIdSchema = z
  .string()
  .min(1, "Server ID cannot be empty")
  .max(VALIDATION_LIMITS.MAX_RESOURCE_NAME_LENGTH, "Server ID is too long")
  .regex(/^[a-zA-Z0-9_.-]+$/, "Server ID contains invalid characters");

/** Validates container name format (Docker naming conventions) */
export const containerNameSchema = z
  .string()
  .min(1, "Container name cannot be empty")
  .max(255, "Container name is too long")
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/,
    "Container name must start with alphanumeric and contain only alphanumeric, underscores, dots, or hyphens",
  );

/** Validates stack ID/name format */
export const stackIdSchema = z
  .string()
  .min(1, "Stack ID cannot be empty")
  .max(VALIDATION_LIMITS.MAX_RESOURCE_NAME_LENGTH, "Stack ID is too long")
  .regex(/^[a-zA-Z0-9_.-]+$/, "Stack ID contains invalid characters");

/** Validates deployment ID/name format */
export const deploymentIdSchema = z
  .string()
  .min(1, "Deployment ID cannot be empty")
  .max(VALIDATION_LIMITS.MAX_RESOURCE_NAME_LENGTH, "Deployment ID is too long")
  .regex(/^[a-zA-Z0-9_.-]+$/, "Deployment ID contains invalid characters");

/** Validates resource name for creation */
export const resourceNameSchema = z
  .string()
  .min(1, "Name cannot be empty")
  .max(VALIDATION_LIMITS.MAX_RESOURCE_NAME_LENGTH, "Name is too long")
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/,
    "Name must start with alphanumeric and contain only alphanumeric, underscores, dots, or hyphens",
  );
