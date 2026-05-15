/**
 * Variable Tools
 *
 * Tools for managing Komodo global Variables. Variables can be interpolated
 * into Stack/Deployment configs via `[[variable.name]]` syntax. Secret variables
 * are redacted in API responses to non-admin users.
 *
 * Tools (4):
 * - `komodo_variable_list`   — list variables
 * - `komodo_variable_info`   — get a variable
 * - `komodo_variable_apply`  — create-or-update (dispatches to UpdateVariableValue/Description/IsSecret on update)
 * - `komodo_variable_delete` — delete a variable
 *
 * @module tools/variable
 */

import { defineTool, structured, z } from "mcp-server-framework";
import { Types } from "komodo_client";
import { ToolCategories, ToolScopes } from "../config/index.js";
import { AppErrorFactory } from "../errors/index.js";
import {
  requireClient,
  wrapApiCall,
  paginate,
  renderVariableList,
  renderVariableInfo,
  buildApplyResult,
  buildDeleteResult,
} from "../utils/index.js";
import {
  variableNameSchema,
  variableListOutputSchema,
  variableInfoOutputSchema,
  variableApplyInputSchema,
  applyResultSchema,
  deleteResultSchema,
  paginationInputSchema,
} from "./schemas/index.js";

type Variable = Types.Variable;

function projectVariable(v: Variable): {
  name: string;
  value: string;
  description?: string;
  is_secret?: boolean;
} {
  return {
    name: v.name,
    value: v.value ?? "",
    ...(v.description !== undefined && v.description !== "" ? { description: v.description } : {}),
    ...(v.is_secret ? { is_secret: true } : {}),
  };
}

// ============================================================================
// List
// ============================================================================

export const listVariablesTool = defineTool({
  name: "komodo_variable_list",
  description:
    "List all global variables registered in Komodo. Secret variables have their value redacted for non-admin users.",
  input: paginationInputSchema,
  output: variableListOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.VARIABLE },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const variables = await wrapApiCall("listVariables", () => komodo.client.read("ListVariables", {}), abortSignal);
    const allItems = variables.map(projectVariable);
    const { items, page } = paginate(allItems, args.cursor, args.page_size);
    const payload = { items: [...items], page };
    return structured(payload, { text: renderVariableList(payload) });
  },
});

// ============================================================================
// Info
// ============================================================================

export const getVariableInfoTool = defineTool({
  name: "komodo_variable_info",
  description: "Get a single Komodo variable. Secret variables are redacted for non-admin users.",
  input: z.object({
    name: variableNameSchema,
  }),
  output: variableInfoOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.VARIABLE },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "getVariable",
      () => komodo.client.read("GetVariable", { name: args.name }),
      abortSignal,
    );
    const payload = { variable: projectVariable(result) };
    return structured(payload, { text: renderVariableInfo(payload) });
  },
});

// ============================================================================
// CRUD
// ============================================================================

export const applyVariableTool = defineTool({
  name: "komodo_variable_apply",
  description: [
    "Create or update a Komodo Variable (PATCH-style on update).",
    'action="create": new variable. Required: name. Optional: value, description, is_secret.',
    'action="update": existing variable (name required). Each of value, description, is_secret triggers a separate update call when provided.',
  ].join("\n"),
  input: variableApplyInputSchema,
  output: applyResultSchema,
  annotations: { idempotentHint: false },
  _meta: { category: ToolCategories.VARIABLE },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    if (args.action === "create") {
      const params: Types.CreateVariable = {
        name: args.name,
        ...(args.value !== undefined && { value: args.value }),
        ...(args.description !== undefined && { description: args.description }),
        ...(args.is_secret !== undefined && { is_secret: args.is_secret }),
      };
      const result = await wrapApiCall(
        "createVariable",
        () => komodo.client.write("CreateVariable", params),
        abortSignal,
      );
      const built = buildApplyResult("create", "variable", args.name, result);
      return structured(built.payload, { text: built.text });
    }
    // update — dispatch to one or more endpoints based on which fields are set
    if (args.value === undefined && args.description === undefined && args.is_secret === undefined) {
      throw AppErrorFactory.validation.fieldRequired("value | description | is_secret");
    }
    let updated: Variable | undefined;
    if (args.value !== undefined) {
      const value = args.value;
      updated = await wrapApiCall(
        "updateVariableValue",
        () => komodo.client.write("UpdateVariableValue", { name: args.name, value }),
        abortSignal,
      );
    }
    if (args.description !== undefined) {
      const description = args.description;
      updated = await wrapApiCall(
        "updateVariableDescription",
        () => komodo.client.write("UpdateVariableDescription", { name: args.name, description }),
        abortSignal,
      );
    }
    if (args.is_secret !== undefined) {
      const is_secret = args.is_secret;
      updated = await wrapApiCall(
        "updateVariableIsSecret",
        () => komodo.client.write("UpdateVariableIsSecret", { name: args.name, is_secret }),
        abortSignal,
      );
    }
    const built = buildApplyResult("update", "variable", args.name, updated);
    return structured(built.payload, { text: built.text });
  },
});

export const deleteVariableTool = defineTool({
  name: "komodo_variable_delete",
  description:
    "Delete a Komodo Variable. Stacks/Deployments referencing it via `[[variable.name]]` will fail to interpolate afterwards.",
  input: z.object({
    name: variableNameSchema,
  }),
  output: deleteResultSchema,
  annotations: { destructiveHint: true },
  _meta: { category: ToolCategories.VARIABLE },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "deleteVariable",
      () => komodo.client.write("DeleteVariable", { name: args.name }),
      abortSignal,
    );
    const built = buildDeleteResult("variable", args.name, result);
    return structured(built.payload, { text: built.text });
  },
});
