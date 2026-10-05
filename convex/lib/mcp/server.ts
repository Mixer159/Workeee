import {
  findTool,
  MCP_TOOLS,
  readToolArguments,
  ToolArgumentError,
} from "./tools";

/**
 * The MCP server, as a pure function of one HTTP body.
 *
 * Workeee speaks MCP over **Streamable HTTP** (`convex/mcp.ts`): every client
 * message is a POST, every answer is a plain JSON body. Nothing here streams
 * and nothing is kept between requests — there are no server-initiated
 * messages to send, so a session id and an SSE stream would be ceremony with
 * nothing inside. The transport allows exactly this shape, and it is the one
 * that fits a Convex HTTP action.
 *
 * Kept free of Convex on purpose: the tool executor is passed in, which is
 * what lets `lib/mcp/server.test.ts` drive the whole protocol with a fake.
 */

export const MCP_SERVER_INFO = { name: "workeee", version: "1.0.0" } as const;

/** Newest first; the first one is what a client asking for anything else gets. */
export const SUPPORTED_PROTOCOL_VERSIONS = [
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
] as const;

const INSTRUCTIONS =
  "Workeee is a team task board: organizations contain projects, projects are Kanban boards of tasks in status columns. " +
  "Call sync_bot_identity once with your display name before anything else. " +
  "Then list_organizations → list_projects → list_tasks to find your way; ids returned by one tool are the arguments of the next. " +
  "You act as a visible bot member, with at most your owner's permissions. Error messages are in Czech.";

export type JsonRpcId = string | number | null;

export type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: JsonRpcId; result: unknown }
  | {
      jsonrpc: "2.0";
      id: JsonRpcId;
      error: { code: number; message: string };
    };

export type ToolOutcome =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

export type CallTool = (
  name: string,
  args: Record<string, unknown>,
) => Promise<ToolOutcome>;

export const JSON_RPC_ERRORS = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internalError: -32603,
} as const;

/**
 * Answer one POST body: a single message, or a batch (2024-11-05 / 2025-03-26
 * allow them). Returns null when there is nothing to answer — notifications
 * and client responses only — which the HTTP layer turns into `202 Accepted`.
 */
export async function handleMcpPayload(
  payload: unknown,
  callTool: CallTool,
): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      return errorResponse(null, JSON_RPC_ERRORS.invalidRequest, "Empty batch.");
    }
    const responses: JsonRpcResponse[] = [];
    for (const message of payload) {
      const response = await handleMessage(message, callTool);
      if (response) {
        responses.push(response);
      }
    }
    return responses.length > 0 ? responses : null;
  }
  return await handleMessage(payload, callTool);
}

async function handleMessage(
  message: unknown,
  callTool: CallTool,
): Promise<JsonRpcResponse | null> {
  if (!isRecord(message) || message.jsonrpc !== "2.0") {
    return errorResponse(null, JSON_RPC_ERRORS.invalidRequest, "Invalid request.");
  }
  if (typeof message.method !== "string") {
    // A client's answer to a server request. We never send any; ignore it.
    if ("result" in message || "error" in message) {
      return null;
    }
    return errorResponse(readId(message), JSON_RPC_ERRORS.invalidRequest, "Invalid request.");
  }

  const isNotification = !("id" in message);
  const id = readId(message);
  const params = isRecord(message.params) ? message.params : {};

  if (isNotification) {
    // `notifications/initialized`, `notifications/cancelled`, … — nothing to do.
    return null;
  }

  switch (message.method) {
    case "initialize":
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: negotiateVersion(params.protocolVersion),
          capabilities: { tools: { listChanged: false } },
          serverInfo: MCP_SERVER_INFO,
          instructions: INSTRUCTIONS,
        },
      };
    case "ping":
      return { jsonrpc: "2.0", id, result: {} };
    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } };
    case "tools/call":
      return await callToolMessage(id, params, callTool);
    // Not advertised, but some clients ask anyway; an empty list is kinder
    // than an error in their log.
    case "resources/list":
      return { jsonrpc: "2.0", id, result: { resources: [] } };
    case "resources/templates/list":
      return { jsonrpc: "2.0", id, result: { resourceTemplates: [] } };
    case "prompts/list":
      return { jsonrpc: "2.0", id, result: { prompts: [] } };
    default:
      return errorResponse(
        id,
        JSON_RPC_ERRORS.methodNotFound,
        `Method not found: ${message.method}`,
      );
  }
}

async function callToolMessage(
  id: JsonRpcId,
  params: Record<string, unknown>,
  callTool: CallTool,
): Promise<JsonRpcResponse> {
  const name = params.name;
  const tool = typeof name === "string" ? findTool(name) : null;
  if (!tool) {
    return errorResponse(
      id,
      JSON_RPC_ERRORS.invalidParams,
      `Unknown tool: ${typeof name === "string" ? name : "(none)"}`,
    );
  }

  let outcome: ToolOutcome;
  try {
    outcome = await callTool(tool.name, readToolArguments(tool, params.arguments));
  } catch (error) {
    if (!(error instanceof ToolArgumentError)) {
      throw error;
    }
    outcome = { ok: false, error: error.message };
  }

  // A tool that ran and refused is a *result* with `isError`, not a JSON-RPC
  // error: the model is meant to read the sentence and try something else.
  return {
    jsonrpc: "2.0",
    id,
    result: outcome.ok
      ? {
          content: [
            { type: "text", text: JSON.stringify(outcome.value ?? null, null, 2) },
          ],
        }
      : { content: [{ type: "text", text: outcome.error }], isError: true },
  };
}

export function negotiateVersion(requested: unknown): string {
  return typeof requested === "string" &&
    (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
    ? requested
    : SUPPORTED_PROTOCOL_VERSIONS[0];
}

export function errorResponse(
  id: JsonRpcId,
  code: number,
  message: string,
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function readId(message: Record<string, unknown>): JsonRpcId {
  const id = message.id;
  return typeof id === "string" || typeof id === "number" ? id : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
