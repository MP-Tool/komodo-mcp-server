import { z } from 'zod';
import { KomodoUpdate } from './types.js';

/**
 * Helper to extract the MongoDB ObjectId string from an Update object
 */
export function extractUpdateId(update: KomodoUpdate): string {
  return update._id?.$oid || 'unknown';
}

// =============================================================================
// Input Validation Schemas
// =============================================================================

/**
 * Validates server ID format.
 * Server IDs can be MongoDB ObjectIds (24 hex chars) or human-readable names.
 */
export const serverIdSchema = z
  .string()
  .min(1, 'Server ID cannot be empty')
  .max(100, 'Server ID is too long')
  .regex(/^[a-zA-Z0-9_.-]+$/, 'Server ID contains invalid characters');

/**
 * Validates container name/ID format.
 * Container names follow Docker naming conventions.
 */
export const containerNameSchema = z
  .string()
  .min(1, 'Container name cannot be empty')
  .max(255, 'Container name is too long')
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/,
    'Container name must start with alphanumeric and contain only alphanumeric, underscores, dots, or hyphens',
  );

/**
 * Validates stack ID/name format.
 */
export const stackIdSchema = z
  .string()
  .min(1, 'Stack ID cannot be empty')
  .max(100, 'Stack ID is too long')
  .regex(/^[a-zA-Z0-9_.-]+$/, 'Stack ID contains invalid characters');

/**
 * Validates deployment ID/name format.
 */
export const deploymentIdSchema = z
  .string()
  .min(1, 'Deployment ID cannot be empty')
  .max(100, 'Deployment ID is too long')
  .regex(/^[a-zA-Z0-9_.-]+$/, 'Deployment ID contains invalid characters');

/**
 * Validates log tail count.
 */
export const tailSchema = z.coerce
  .number()
  .int('Tail must be an integer')
  .min(1, 'Tail must be at least 1')
  .max(10000, 'Tail cannot exceed 10000');

/**
 * Validates resource name for creation.
 */
export const resourceNameSchema = z
  .string()
  .min(1, 'Name cannot be empty')
  .max(100, 'Name is too long')
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/,
    'Name must start with alphanumeric and contain only alphanumeric, underscores, dots, or hyphens',
  );

/**
 * Type exports for external use
 */
export type ServerId = z.infer<typeof serverIdSchema>;
export type ContainerName = z.infer<typeof containerNameSchema>;
export type StackId = z.infer<typeof stackIdSchema>;
export type DeploymentId = z.infer<typeof deploymentIdSchema>;
export type TailCount = z.infer<typeof tailSchema>;
export type ResourceName = z.infer<typeof resourceNameSchema>;

/**
 * Validation helper functions that throw descriptive errors
 */
export function validateServerId(id: string): ServerId {
  return serverIdSchema.parse(id);
}

export function validateContainerName(name: string): ContainerName {
  return containerNameSchema.parse(name);
}

export function validateStackId(id: string): StackId {
  return stackIdSchema.parse(id);
}

export function validateDeploymentId(id: string): DeploymentId {
  return deploymentIdSchema.parse(id);
}

export function validateTail(tail: number): TailCount {
  return tailSchema.parse(tail);
}

export function validateResourceName(name: string): ResourceName {
  return resourceNameSchema.parse(name);
}
