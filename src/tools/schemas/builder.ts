/**
 * Builder Schemas
 *
 * Zod schemas for Komodo Builder resources (`komodo_builder_*` tools). A Builder
 * is the compute target Komodo uses to run a Docker build (referenced by a Build's
 * `builder_id`).
 *
 * The config is exposed as a FLAT, fully-described object (not the SDK's discriminated
 * union) so MCP clients render a proper form — not a raw-JSON box — and an agent sees
 * exactly which fields it can set and what each does. `toBuilderConfig` assembles the
 * flat input into the SDK's `PartialBuilderConfig`.
 *
 * @module tools/schemas/builder
 */

import { z } from "zod";
import { Types } from "komodo_client";
import { resourceNameSchema } from "./validators.js";
import { pageOutputSchema, resourceLinkSchema } from "./shared.js";

/** Builder identifier (id or name) accepted by the Komodo API. */
export const builderIdSchema = z.string().min(1);

/** Compact summary of a single builder. */
export const builderSummarySchema = z.object({
  id: z.string().describe("Builder ID"),
  name: z.string().describe("Builder name"),
  builder_type: z.string().optional().describe("Builder variant: 'Url', 'Server', or 'Aws'"),
  instance_type: z
    .string()
    .optional()
    .describe("If 'Server': the server id. If 'Aws': the EC2 instance type. If 'Url': absent."),
});

export const builderListOutputSchema = z
  .object({
    items: z.array(builderSummarySchema).describe("Builders registered in Komodo"),
    page: pageOutputSchema.optional(),
  })
  .describe("List of registered builders");

export const builderInfoOutputSchema = z
  .object({
    summary: builderSummarySchema,
    info: z.unknown().optional().describe("Full Builder resource (only when not offloaded as a resource link)"),
    resourceLink: resourceLinkSchema.optional(),
  })
  .describe("Builder summary + optional full resource");

// ============================================================================
// Config — flat, fully-described (assembled into Types.PartialBuilderConfig)
// ============================================================================

/**
 * Flat Builder configuration. Every field is a plain scalar so MCP clients render a form
 * (not a raw-JSON box) and an agent sees exactly which fields it can set and what each does.
 * `builder_type` selects the backend; `toBuilderConfig` keeps only the fields that apply to
 * that type and assembles the SDK's discriminated `PartialBuilderConfig`.
 *
 * Provider-account arrays (git/registry credentials, AMI secrets) are intentionally NOT
 * exposed here — they carry tokens and belong in the AMI / Komodo UI, not an MCP call.
 */
export const builderConfigSchema = z
  .object({
    builder_type: z
      .enum(["Url", "Server", "Aws"])
      .optional()
      .describe(
        "Which build backend: 'Url' = a Periphery agent address, 'Server' = a connected Komodo server, 'Aws' = an on-demand EC2 instance. Inferred from the fields you set if omitted.",
      ),

    // [Url] Periphery address
    address: z.string().optional().describe("[Url] Address of the Periphery agent (e.g. https://periphery:8120)"),

    // [Server] connected server
    server_id: z.string().optional().describe("[Server] Id or name of the connected Komodo server to build on"),

    // [Aws] on-demand EC2
    region: z.string().optional().describe("[Aws] AWS region to launch the build instance in"),
    instance_type: z.string().optional().describe("[Aws] EC2 instance type for the build (e.g. c5.xlarge)"),
    volume_gb: z.number().optional().describe("[Aws] Size of the builder volume, in GB"),
    ami_id: z.string().optional().describe("[Aws] EC2 AMI id (Periphery preconfigured to start on boot)"),
    subnet_id: z.string().optional().describe("[Aws] Subnet id to launch the instance in"),
    key_pair_name: z.string().optional().describe("[Aws] EC2 key-pair name to attach"),
    assign_public_ip: z.boolean().optional().describe("[Aws] Assign a public IP (usually needed for internet access)"),
    use_public_ip: z.boolean().optional().describe("[Aws] Have Core reach Periphery via the public IP (else private)"),
    security_group_ids: z
      .array(z.string())
      .optional()
      .describe("[Aws] Security-group ids (must allow Core→Periphery on the port)"),
    user_data: z.string().optional().describe("[Aws] User-data script to launch the instance with"),
    port: z.number().optional().describe("[Aws] Port Periphery runs on. Default: 8120"),
    use_https: z.boolean().optional().describe("[Aws] Whether Periphery is served over https"),

    // [Url + Aws] Periphery trust
    periphery_public_key: z
      .string()
      .optional()
      .describe("[Url, Aws] Expected Periphery public key. Empty = skip validation."),
    insecure_tls: z.boolean().optional().describe("[Url, Aws] Skip validating Periphery's TLS certificate"),

    // [Url] legacy
    passkey: z
      .string()
      .optional()
      .describe("[Url] Deprecated — use public/private keys. Empty = use Core config passkey."),
  })
  .describe("Builder configuration — set `builder_type` and the fields for that backend");

export type BuilderConfigInput = z.infer<typeof builderConfigSchema>;

/** Infer the builder backend from whichever identifying field is set. */
function inferBuilderType(c: BuilderConfigInput): "Url" | "Server" | "Aws" | undefined {
  if (c.builder_type) return c.builder_type;
  if (c.address !== undefined) return "Url";
  if (c.server_id !== undefined) return "Server";
  if (c.region !== undefined || c.instance_type !== undefined || c.ami_id !== undefined) return "Aws";
  return undefined;
}

/**
 * Assemble the flat input into the SDK's discriminated `PartialBuilderConfig`, keeping only
 * the fields that apply to the chosen `builder_type`. Returns `undefined` when no config was
 * supplied (type can't be determined) so callers treat it as "no config change".
 */
export function toBuilderConfig(c: BuilderConfigInput | undefined): Types.PartialBuilderConfig | undefined {
  if (!c) return undefined;
  const type = inferBuilderType(c);
  if (!type) return undefined;

  if (type === "Url") {
    const params: Types._PartialUrlBuilderConfig = {
      ...(c.address !== undefined && { address: c.address }),
      ...(c.periphery_public_key !== undefined && { periphery_public_key: c.periphery_public_key }),
      ...(c.insecure_tls !== undefined && { insecure_tls: c.insecure_tls }),
      ...(c.passkey !== undefined && { passkey: c.passkey }),
    };
    return { type, params };
  }

  if (type === "Server") {
    // SDK expects `server_ids: string[]`; the tool takes a single friendly `server_id`.
    const params: Types._PartialServerBuilderConfig = c.server_id !== undefined ? { server_ids: [c.server_id] } : {};
    return { type, params };
  }

  const params: Types._PartialAwsBuilderConfig = {
    ...(c.region !== undefined && { region: c.region }),
    ...(c.instance_type !== undefined && { instance_type: c.instance_type }),
    ...(c.volume_gb !== undefined && { volume_gb: c.volume_gb }),
    ...(c.ami_id !== undefined && { ami_id: c.ami_id }),
    ...(c.subnet_id !== undefined && { subnet_id: c.subnet_id }),
    ...(c.key_pair_name !== undefined && { key_pair_name: c.key_pair_name }),
    ...(c.assign_public_ip !== undefined && { assign_public_ip: c.assign_public_ip }),
    ...(c.use_public_ip !== undefined && { use_public_ip: c.use_public_ip }),
    ...(c.security_group_ids !== undefined && { security_group_ids: c.security_group_ids }),
    ...(c.user_data !== undefined && { user_data: c.user_data }),
    ...(c.port !== undefined && { port: c.port }),
    ...(c.use_https !== undefined && { use_https: c.use_https }),
    ...(c.periphery_public_key !== undefined && { periphery_public_key: c.periphery_public_key }),
    ...(c.insecure_tls !== undefined && { insecure_tls: c.insecure_tls }),
  };
  return { type, params };
}

// ============================================================================
// Input Schemas — CRUD
// ============================================================================

export const builderApplyInputSchema = z.object({
  action: z
    .enum(["create", "update"])
    .describe("'create' to register a new builder, 'update' to PATCH an existing one"),
  name: resourceNameSchema.optional().describe("Required when action='create' — unique name for the new builder"),
  builder: builderIdSchema.optional().describe("Required when action='update' — existing builder id or name"),
  config: builderConfigSchema
    .optional()
    .describe("Builder configuration — set `builder_type` and the fields for that backend"),
});

export const builderCopyInputSchema = z.object({
  name: resourceNameSchema.describe("Name for the new builder"),
  id: builderIdSchema.describe("Id or name of the existing builder to copy the configuration from"),
});

export const builderRenameInputSchema = z.object({
  builder: builderIdSchema.describe("Id or name of the builder to rename"),
  name: resourceNameSchema.describe("New name for the builder"),
});
