/**
 * Docker Introspection Schemas
 *
 * Zod schemas for raw Docker image/network/volume introspection
 * (`komodo_docker_*` tools) on a Komodo-managed server — the read-only
 * counterpart to `komodo_container_*`, modeled on `schemas/container.ts`'s
 * summary/inspect split.
 *
 * @module tools/schemas/docker
 */

import { z } from "zod";
import { resourceLinkSchema, pageOutputSchema } from "./shared.js";

// ============================================================================
// Images
// ============================================================================

export const imageSummarySchema = z.object({
  id: z.string().describe("Content-addressable image ID"),
  name: z.string().describe("First repo tag, or the image ID if untagged"),
  tags: z.array(z.string()).optional().describe("All repo tags"),
  size: z.number().int().optional().describe("Total image size in bytes"),
  in_use: z.boolean().optional().describe("Whether any container currently uses this image"),
});

export const imageListOutputSchema = z
  .object({
    items: z.array(imageSummarySchema).describe("Docker images cached on the target server"),
    page: pageOutputSchema.optional(),
  })
  .describe("List of Docker images on a server");

/** Enriched inspect summary — the key facts, so the default response is useful without the resource. */
const imageInspectSummarySchema = z.object({
  name: z.string(),
  size: z.number().int().optional().describe("Image size in bytes"),
  architecture: z.string().optional(),
  os: z.string().optional(),
  tags: z.array(z.string()).optional().describe("Repo tags"),
});

export const imageInspectOutputSchema = z
  .object({
    summary: imageInspectSummarySchema,
    inspect: z.unknown().optional().describe("Raw Docker image inspect payload, when returned inline"),
    resourceLink: resourceLinkSchema.optional(),
  })
  .describe("Docker inspect data for an image");

export const imageHistoryEntrySchema = z.object({
  id: z.string().describe("Layer ID"),
  created: z.number().int().describe("Unix timestamp (seconds) the layer was created"),
  created_by: z.string().describe("Command that produced this layer"),
  size: z.number().int().describe("Layer size in bytes"),
  tags: z.array(z.string()).optional().describe("Tags associated with this layer, if any"),
});

export const imageHistoryOutputSchema = z
  .object({
    summary: z.object({ name: z.string(), layers: z.number().int().optional() }),
    items: z.array(imageHistoryEntrySchema).describe("Image layer history, most recent first"),
    resourceLink: resourceLinkSchema.optional(),
  })
  .describe("Layer history for a Docker image");

// ============================================================================
// Networks
// ============================================================================

export const networkSummarySchema = z.object({
  name: z.string().optional().describe("Network name"),
  id: z.string().optional().describe("Network ID"),
  driver: z.string().optional().describe("Network driver (bridge, overlay, host, ...)"),
  scope: z.string().optional().describe("Network scope (local, swarm, ...)"),
});

export const networkListOutputSchema = z
  .object({
    items: z.array(networkSummarySchema).describe("Docker networks on the target server"),
    page: pageOutputSchema.optional(),
  })
  .describe("List of Docker networks on a server");

const networkInspectSummarySchema = z.object({
  name: z.string(),
  driver: z.string().optional(),
  scope: z.string().optional(),
  subnet: z.string().optional().describe("First IPAM subnet, if any"),
});

export const networkInspectOutputSchema = z
  .object({
    summary: networkInspectSummarySchema,
    inspect: z.unknown().optional().describe("Raw Docker network inspect payload, when returned inline"),
    resourceLink: resourceLinkSchema.optional(),
  })
  .describe("Docker inspect data for a network");

// ============================================================================
// Volumes
// ============================================================================

export const volumeSummarySchema = z.object({
  name: z.string().describe("Volume name"),
  driver: z.string().optional().describe("Volume driver"),
  mountpoint: z.string().optional().describe("Host mountpoint path"),
  in_use: z.boolean().optional().describe("Whether any container currently uses this volume"),
});

export const volumeListOutputSchema = z
  .object({
    items: z.array(volumeSummarySchema).describe("Docker volumes on the target server"),
    page: pageOutputSchema.optional(),
  })
  .describe("List of Docker volumes on a server");

const volumeInspectSummarySchema = z.object({
  name: z.string(),
  driver: z.string().optional(),
  mountpoint: z.string().optional(),
  scope: z.string().optional(),
});

export const volumeInspectOutputSchema = z
  .object({
    summary: volumeInspectSummarySchema,
    inspect: z.unknown().optional().describe("Raw Docker volume inspect payload, when returned inline"),
    resourceLink: resourceLinkSchema.optional(),
  })
  .describe("Docker inspect data for a volume");
