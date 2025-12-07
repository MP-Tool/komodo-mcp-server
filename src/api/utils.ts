import { KomodoUpdate } from './types.js';

/**
 * Helper to extract the MongoDB ObjectId string from an Update object
 */
export function extractUpdateId(update: KomodoUpdate): string {
  return update._id?.$oid || 'unknown';
}
