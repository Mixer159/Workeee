/**
 * The MCP tool catalog — names, descriptions and JSON Schemas, as `tools/list`
 * returns them. Pure data, no Convex: what each tool *does* is in
 * `convex/mcpTools.ts`, and the mapping between the two is the dispatch table
 * in `convex/mcp.ts`.
 *
 * Descriptions are written for the model that reads them, in English; the
 * errors a tool returns are the app's own Czech sentences.
 */

export type JsonSchema = {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties: false;
};

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
};

const id = (what: string) => ({
  type: "string",
  description: `Workeee ${what} id, as returned by another tool.`,
});

const nullableUserId = {
  type: ["string", "null"],
  description:
    "Workeee user id from list_members (people and bots alike), or null to unassign.",
};

function schema(
  properties: Record<string, unknown>,
  required: string[] = [],
): JsonSchema {
  return required.length > 0
    ? { type: "object", properties, required, additionalProperties: false }
    : { type: "object", properties, additionalProperties: false };
}

export const MCP_TOOLS: readonly ToolDefinition[] = [
  {
    name: "sync_bot_identity",
    description:
      "Call this first, and again whenever your profile changes. Registers you as a bot member owned by the person whose API token you use, or updates your name and avatar. Workeee shows you to the team under this name with a Bot badge. Until it has been called, every other tool refuses.",
    inputSchema: schema(
      {
        name: {
          type: "string",
          description: "Your display name, e.g. Codie. At most 60 characters.",
        },
        avatarUrl: {
          type: "string",
          description:
            "https:// URL of your avatar. Omit to keep the current one; an empty string removes it.",
        },
      },
      ["name"],
    ),
  },
  {
    name: "list_organizations",
    description:
      "Organizations you have been added to as a member. A bot sees nothing until an organization manager who owns it adds it in the organization settings.",
    inputSchema: schema({}),
  },
  {
    name: "list_projects",
    description: "Projects you can open in one organization (archived ones excluded).",
    inputSchema: schema({ organizationId: id("organization") }, ["organizationId"]),
  },
  {
    name: "list_tasks",
    description:
      "The whole board of a project: its statuses in column order, and every task with its status and assignee, ordered as on the board.",
    inputSchema: schema({ projectId: id("project") }, ["projectId"]),
  },
  {
    name: "get_task",
    description:
      "One task in detail: title, status, assignee, author, timestamps and the description as plain text. Set includeComments to also get the discussion.",
    inputSchema: schema(
      {
        taskId: id("task"),
        includeComments: {
          type: "boolean",
          description: "Include the comment stream. Defaults to false.",
        },
      },
      ["taskId"],
    ),
  },
  {
    name: "list_members",
    description:
      "Everyone who can open a project — the people (and bots) a task there can be assigned to.",
    inputSchema: schema({ projectId: id("project") }, ["projectId"]),
  },
  {
    name: "create_task",
    description:
      "Create a task at the end of a status column. Without statusId it goes to the project's To-do column.",
    inputSchema: schema(
      {
        projectId: id("project"),
        title: { type: "string", description: "At most 200 characters." },
        statusId: id("status"),
      },
      ["projectId", "title"],
    ),
  },
  {
    name: "update_task",
    description:
      "Rename a task and/or change its assignee in one call. Pass at least one of title and assigneeId.",
    inputSchema: schema(
      {
        taskId: id("task"),
        title: { type: "string", description: "New title, at most 200 characters." },
        assigneeId: nullableUserId,
      },
      ["taskId"],
    ),
  },
  {
    name: "move_task",
    description:
      "Move a task to a status column. Optionally place it between two tasks of that column (previousTaskId above, nextTaskId below); with neither it goes to the end.",
    inputSchema: schema(
      {
        taskId: id("task"),
        statusId: id("status"),
        previousTaskId: id("task"),
        nextTaskId: id("task"),
      },
      ["taskId", "statusId"],
    ),
  },
  {
    name: "assign_task",
    description:
      "Set or clear a task's assignee. The assignee must be able to open the project (see list_members).",
    inputSchema: schema(
      { taskId: id("task"), assigneeId: nullableUserId },
      ["taskId", "assigneeId"],
    ),
  },
  {
    name: "list_comments",
    description: "The comments under a task, oldest first, as plain text.",
    inputSchema: schema({ taskId: id("task") }, ["taskId"]),
  },
  {
    name: "add_comment",
    description:
      "Post a plain-text comment under a task as yourself. At most 5000 characters. Mentions are not supported: '@Name' stays plain text and notifies nobody.",
    inputSchema: schema(
      { taskId: id("task"), text: { type: "string" } },
      ["taskId", "text"],
    ),
  },
  {
    name: "search",
    description:
      "Find tasks whose title contains the query (case-insensitive) across every project you can open, newest activity first. Covers the 500 most recently updated tasks of each project.",
    inputSchema: schema(
      {
        query: { type: "string", description: "At least 2 characters." },
        organizationId: id("organization"),
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 50,
          description: "Defaults to 20.",
        },
      },
      ["query"],
    ),
  },
];

/** A tool call's arguments did not match its schema. Reported as a tool error. */
export class ToolArgumentError extends Error {}

/**
 * Read the arguments of `tool` against its schema: required keys present,
 * unknown keys refused, every value of the declared JSON type. What reaches
 * the internal function has the shape its Convex validator expects.
 */
export function readToolArguments(
  tool: ToolDefinition,
  raw: unknown,
): Record<string, unknown> {
  const args = raw === undefined || raw === null ? {} : raw;
  if (typeof args !== "object" || Array.isArray(args)) {
    throw new ToolArgumentError("Argumenty musí být objekt.");
  }
  const record = args as Record<string, unknown>;
  const { properties, required = [] } = tool.inputSchema;

  for (const key of Object.keys(record)) {
    if (!(key in properties)) {
      throw new ToolArgumentError(`Neznámý argument: ${key}.`);
    }
  }
  for (const key of required) {
    if (record[key] === undefined) {
      throw new ToolArgumentError(`Chybí argument: ${key}.`);
    }
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === undefined) {
      continue;
    }
    const declared = (properties[key] as { type: string | string[] }).type;
    const types = Array.isArray(declared) ? declared : [declared];
    if (!types.some((type) => matchesType(type, value))) {
      throw new ToolArgumentError(
        `Argument ${key} má mít typ ${types.join(" nebo ")}.`,
      );
    }
    result[key] = value;
  }
  return result;
}

function matchesType(type: string, value: unknown): boolean {
  switch (type) {
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "null":
      return value === null;
    default:
      return false;
  }
}

export function findTool(name: string): ToolDefinition | null {
  return MCP_TOOLS.find((tool) => tool.name === name) ?? null;
}
