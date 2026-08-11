/**
 * Docker Introspection Tools
 *
 * Raw Docker image/network/volume introspection on a Komodo-managed server —
 * the read-only counterpart to `komodo_container_*`, closing the "containers
 * only" gap. Modeled on `tools/container.ts`'s summary/inspect + resource-link
 * offload pattern.
 *
 * Tools (7): image list/inspect/history, network list/inspect, volume list/inspect.
 *
 * Secret redaction is the framework's job (inline results pass the central tool-result
 * boundary; offloaded content is scrubbed on register).
 *
 * @module tools/docker
 */

import { defineTool, structured, z } from "mcp-server-framework";
import { Types } from "komodo_client";
import { PARAM_DESCRIPTIONS, ToolCategories, ToolScopes, config } from "../config/index.js";
import {
  requireClient,
  requireKomodoPermission,
  wrapApiCall,
  paginate,
  tryRegisterResource,
  renderImageList,
  renderImageInspect,
  renderImageHistory,
  renderNetworkList,
  renderNetworkInspect,
  renderVolumeList,
  renderVolumeInspect,
} from "../utils/index.js";
import {
  serverIdSchema,
  imageListOutputSchema,
  imageInspectOutputSchema,
  imageHistoryOutputSchema,
  networkListOutputSchema,
  networkInspectOutputSchema,
  volumeListOutputSchema,
  volumeInspectOutputSchema,
  inlineFullInputSchema,
  paginationInputSchema,
} from "./schemas/index.js";

type ImageListItem = Types.ImageListItem;
type NetworkListItem = Types.NetworkListItem;
type VolumeListItem = Types.VolumeListItem;
type ImageHistoryResponseItem = Types.ImageHistoryResponseItem;

const READ = Types.PermissionLevel.Read;

// Komodo Core v2.3 dropped the "Docker" prefix from these read APIs (e.g. `ListDockerImages` →
// `ListImages`). Core ≥ 2.3 keeps the old names as serde aliases; Core ≤ 2.2 only knows the old
// names. We send the legacy names (compatible with every Komodo v2 core, 2.0–2.3+) typed via the
// current names, since the 2.3.x client dropped the old aliases from its generated types — the
// same back-compat approach as `tools/container.ts`.
const LIST_IMAGES = "ListDockerImages" as unknown as "ListImages";
const INSPECT_IMAGE = "InspectDockerImage" as unknown as "InspectImage";
const LIST_IMAGE_HISTORY = "ListDockerImageHistory" as unknown as "ListImageHistory";
const LIST_NETWORKS = "ListDockerNetworks" as unknown as "ListNetworks";
const INSPECT_NETWORK = "InspectDockerNetwork" as unknown as "InspectNetwork";
const LIST_VOLUMES = "ListDockerVolumes" as unknown as "ListVolumes";
const INSPECT_VOLUME = "InspectDockerVolume" as unknown as "InspectVolume";

// ============================================================================
// Images
// ============================================================================

export const listDockerImagesTool = defineTool({
  name: "komodo_docker_image_list",
  description: "List Docker images cached locally on a server, with size and in-use status.",
  input: z
    .object({ server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID_REQUIRED) })
    .merge(paginationInputSchema),
  output: imageListOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.DOCKER },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    await requireKomodoPermission({ type: "Server", id: args.server }, READ);
    const images = await wrapApiCall(
      "listDockerImages",
      () => komodo.client.read(LIST_IMAGES, { server: args.server }),
      abortSignal,
    );
    const allItems = images.map((i: ImageListItem) => ({
      id: i.id,
      name: i.name,
      ...(i.tags ? { tags: i.tags } : {}),
      size: i.size,
      in_use: i.in_use,
    }));
    const { items, page } = paginate(allItems, args.cursor, args.page_size);
    const payload = { items: [...items], page };
    return structured(payload, { text: renderImageList(payload) });
  },
});

export const inspectDockerImageTool = defineTool({
  name: "komodo_docker_image_inspect",
  description: "Get detailed Docker inspect data for an image (config, layers, exposed ports, env, labels).",
  input: z
    .object({
      server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID_REQUIRED),
      image: z.string().min(1).describe("Image name or ID to inspect"),
    })
    .merge(inlineFullInputSchema),
  output: imageInspectOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.DOCKER },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal, sessionId }) => {
    const komodo = requireClient();
    await requireKomodoPermission({ type: "Server", id: args.server }, READ);
    const result = await wrapApiCall(
      "inspectDockerImage",
      () => komodo.client.read(INSPECT_IMAGE, { server: args.server, image: args.image }),
      abortSignal,
    );
    const summary = {
      name: args.image,
      ...(result.Size !== undefined && { size: result.Size }),
      ...(result.Architecture && { architecture: result.Architecture }),
      ...(result.Os && { os: result.Os }),
      ...(result.RepoTags && { tags: result.RepoTags }),
    };
    const link = tryRegisterResource({
      ctx: { sessionId },
      category: "inspect",
      name: `${args.image} (inspect)`,
      mimeType: "application/json",
      content: JSON.stringify(result, null, 2),
      ttlMs: config.MCP_RESOURCE_TTL_INFO,
      inlineFull: args.inline_full,
      description: `Docker inspect data for image ${args.image} on ${args.server}`,
    });
    const payload = link ? { summary, resourceLink: link } : { summary, inspect: result };
    return structured(payload, { text: renderImageInspect(payload), ...(link ? { links: [link] } : {}) });
  },
});

export const getDockerImageHistoryTool = defineTool({
  name: "komodo_docker_image_history",
  description: "Get the layer history of a Docker image (each build step, its size, and the command that produced it).",
  input: z
    .object({
      server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID_REQUIRED),
      image: z.string().min(1).describe("Image name or ID"),
    })
    .merge(inlineFullInputSchema),
  output: imageHistoryOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.DOCKER },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal, sessionId }) => {
    const komodo = requireClient();
    await requireKomodoPermission({ type: "Server", id: args.server }, READ);
    const result = await wrapApiCall(
      "listDockerImageHistory",
      () => komodo.client.read(LIST_IMAGE_HISTORY, { server: args.server, image: args.image }),
      abortSignal,
    );
    const items = result.map((l: ImageHistoryResponseItem) => ({
      id: l.Id,
      created: l.Created,
      created_by: l.CreatedBy,
      size: l.Size,
      ...(l.Tags ? { tags: l.Tags } : {}),
    }));
    const summary = { name: args.image, layers: items.length };
    const link = tryRegisterResource({
      ctx: { sessionId },
      category: "inspect",
      name: `${args.image} (history)`,
      mimeType: "application/json",
      content: JSON.stringify(items, null, 2),
      ttlMs: config.MCP_RESOURCE_TTL_INFO,
      inlineFull: args.inline_full,
      description: `Layer history for image ${args.image} on ${args.server}`,
    });
    const payload = link ? { summary, items: [], resourceLink: link } : { summary, items };
    return structured(payload, { text: renderImageHistory(payload), ...(link ? { links: [link] } : {}) });
  },
});

// ============================================================================
// Networks
// ============================================================================

export const listDockerNetworksTool = defineTool({
  name: "komodo_docker_network_list",
  description: "List Docker networks on a server, with driver and scope.",
  input: z
    .object({ server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID_REQUIRED) })
    .merge(paginationInputSchema),
  output: networkListOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.DOCKER },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    await requireKomodoPermission({ type: "Server", id: args.server }, READ);
    const networks = await wrapApiCall(
      "listDockerNetworks",
      () => komodo.client.read(LIST_NETWORKS, { server: args.server }),
      abortSignal,
    );
    const allItems = networks.map((n: NetworkListItem) => ({
      ...(n.name ? { name: n.name } : {}),
      ...(n.id ? { id: n.id } : {}),
      ...(n.driver ? { driver: n.driver } : {}),
      ...(n.scope ? { scope: n.scope } : {}),
    }));
    const { items, page } = paginate(allItems, args.cursor, args.page_size);
    const payload = { items: [...items], page };
    return structured(payload, { text: renderNetworkList(payload) });
  },
});

export const inspectDockerNetworkTool = defineTool({
  name: "komodo_docker_network_inspect",
  description: "Get detailed Docker inspect data for a network (subnets, connected containers, IPAM config).",
  input: z
    .object({
      server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID_REQUIRED),
      network: z.string().min(1).describe("Network name or ID to inspect"),
    })
    .merge(inlineFullInputSchema),
  output: networkInspectOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.DOCKER },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal, sessionId }) => {
    const komodo = requireClient();
    await requireKomodoPermission({ type: "Server", id: args.server }, READ);
    const result = await wrapApiCall(
      "inspectDockerNetwork",
      () => komodo.client.read(INSPECT_NETWORK, { server: args.server, network: args.network }),
      abortSignal,
    );
    const subnet = result.IPAM?.Config[0]?.Subnet;
    const summary = {
      name: args.network,
      ...(result.Driver && { driver: result.Driver }),
      ...(result.Scope && { scope: result.Scope }),
      ...(subnet && { subnet }),
    };
    const link = tryRegisterResource({
      ctx: { sessionId },
      category: "inspect",
      name: `${args.network} (inspect)`,
      mimeType: "application/json",
      content: JSON.stringify(result, null, 2),
      ttlMs: config.MCP_RESOURCE_TTL_INFO,
      inlineFull: args.inline_full,
      description: `Docker inspect data for network ${args.network} on ${args.server}`,
    });
    const payload = link ? { summary, resourceLink: link } : { summary, inspect: result };
    return structured(payload, { text: renderNetworkInspect(payload), ...(link ? { links: [link] } : {}) });
  },
});

// ============================================================================
// Volumes
// ============================================================================

export const listDockerVolumesTool = defineTool({
  name: "komodo_docker_volume_list",
  description: "List Docker volumes on a server, with driver, mountpoint, and in-use status.",
  input: z
    .object({ server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID_REQUIRED) })
    .merge(paginationInputSchema),
  output: volumeListOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.DOCKER },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    await requireKomodoPermission({ type: "Server", id: args.server }, READ);
    const volumes = await wrapApiCall(
      "listDockerVolumes",
      () => komodo.client.read(LIST_VOLUMES, { server: args.server }),
      abortSignal,
    );
    const allItems = volumes.map((v: VolumeListItem) => ({
      name: v.name,
      ...(v.driver ? { driver: v.driver } : {}),
      ...(v.mountpoint ? { mountpoint: v.mountpoint } : {}),
      in_use: v.in_use,
    }));
    const { items, page } = paginate(allItems, args.cursor, args.page_size);
    const payload = { items: [...items], page };
    return structured(payload, { text: renderVolumeList(payload) });
  },
});

export const inspectDockerVolumeTool = defineTool({
  name: "komodo_docker_volume_inspect",
  description: "Get detailed Docker inspect data for a volume (labels, driver options, scope).",
  input: z
    .object({
      server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID_REQUIRED),
      volume: z.string().min(1).describe("Volume name to inspect"),
    })
    .merge(inlineFullInputSchema),
  output: volumeInspectOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.DOCKER },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal, sessionId }) => {
    const komodo = requireClient();
    await requireKomodoPermission({ type: "Server", id: args.server }, READ);
    const result = await wrapApiCall(
      "inspectDockerVolume",
      () => komodo.client.read(INSPECT_VOLUME, { server: args.server, volume: args.volume }),
      abortSignal,
    );
    const summary = {
      name: args.volume,
      ...(result.Driver && { driver: result.Driver }),
      ...(result.Mountpoint && { mountpoint: result.Mountpoint }),
      ...(result.Scope && { scope: result.Scope }),
    };
    const link = tryRegisterResource({
      ctx: { sessionId },
      category: "inspect",
      name: `${args.volume} (inspect)`,
      mimeType: "application/json",
      content: JSON.stringify(result, null, 2),
      ttlMs: config.MCP_RESOURCE_TTL_INFO,
      inlineFull: args.inline_full,
      description: `Docker inspect data for volume ${args.volume} on ${args.server}`,
    });
    const payload = link ? { summary, resourceLink: link } : { summary, inspect: result };
    return structured(payload, { text: renderVolumeInspect(payload), ...(link ? { links: [link] } : {}) });
  },
});
