import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { httpAction, type ActionCtx } from "./_generated/server";
import { hashApiToken, parseBearerToken } from "./lib/apiTokens";
import {
  errorResponse,
  handleMcpPayload,
  JSON_RPC_ERRORS,
  MCP_SERVER_INFO,
  type ToolOutcome,
} from "./lib/mcp/server";

/**
 * The remote MCP endpoint: `https://<deployment>.convex.site/mcp`, on the same
 * host as the Better Auth routes. Registered in `convex/http.ts`.
 *
 * Streamable HTTP, stateless: every POST carries `Authorization: Bearer
 * <api token>`, is answered with one JSON body, and needs nothing from the
 * request before it. **No OAuth metadata is served** — no
 * `/.well-known/oauth-*` route exists, so those paths 404 — because an MCP
 * client that finds authorization-server metadata switches to OAuth and stops
 * sending the Bearer header it was configured with.
 *
 * CORS is open (`*`): the credential is a header the caller has to hold, not a
 * cookie a browser attaches on its own, so another origin gains nothing from
 * being allowed to ask.
 */

/** A JSON-RPC message is small; anything past this is not one. */
const MAX_BODY_BYTES = 1_000_000;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

export const mcpPost = httpAction(async (ctx, request) => {
  const token = parseBearerToken(request.headers.get("Authorization"));
  const tokenHash = token ? await hashApiToken(token) : null;
  const authenticated = tokenHash
    ? await ctx.runMutation(internal.mcpTools.authenticate, { tokenHash })
    : null;
  if (!tokenHash || !authenticated) {
    return json(
      errorResponse(null, JSON_RPC_ERRORS.invalidRequest, "Neplatný nebo chybějící API token."),
      401,
      // A plain Bearer challenge — deliberately without `resource_metadata`,
      // which would send the client looking for an OAuth server.
      { "WWW-Authenticate": 'Bearer realm="workeee"' },
    );
  }

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return json(
      errorResponse(null, JSON_RPC_ERRORS.invalidRequest, "Request too large."),
      413,
    );
  }
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return json(
      errorResponse(null, JSON_RPC_ERRORS.parseError, "Parse error."),
      400,
    );
  }

  const response = await handleMcpPayload(payload, (name, args) =>
    runTool(ctx, tokenHash, name, args),
  );
  if (response === null) {
    return new Response(null, { status: 202, headers: CORS_HEADERS });
  }
  return json(response, 200);
});

/**
 * No server-to-client stream exists, and the transport says so with a 405 to
 * anybody asking for one. A plain GET — a person or a health check — gets a
 * short description instead.
 */
export const mcpGet = httpAction(async (_ctx, request) => {
  if ((request.headers.get("Accept") ?? "").includes("text/event-stream")) {
    return methodNotAllowed();
  }
  return json(
    { ...MCP_SERVER_INFO, transport: "streamable-http", auth: "Bearer API token" },
    200,
  );
});

/** Stateless: there is no session to end. */
export const mcpDelete = httpAction(async () => methodNotAllowed());

export const mcpOptions = httpAction(
  async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
);

type ToolArgs = Record<string, unknown>;
type ToolHandler = (
  ctx: ActionCtx,
  tokenHash: string,
  args: ToolArgs,
) => Promise<unknown>;

/**
 * Tool name → internal function. The arguments have already been checked
 * against the tool's schema (`readToolArguments`), so the casts below only
 * restate what that check proved.
 */
const TOOL_HANDLERS: Record<string, ToolHandler> = {
  sync_bot_identity: (ctx, tokenHash, args) =>
    ctx.runMutation(internal.bots.syncIdentity, {
      tokenHash,
      ...(args as { name: string; avatarUrl?: string }),
    }),
  list_organizations: (ctx, tokenHash) =>
    ctx.runQuery(internal.mcpTools.listOrganizations, { tokenHash }),
  list_projects: (ctx, tokenHash, args) =>
    ctx.runQuery(internal.mcpTools.listProjects, {
      tokenHash,
      ...(args as { organizationId: string }),
    }),
  list_tasks: (ctx, tokenHash, args) =>
    ctx.runQuery(internal.mcpTools.listTasks, {
      tokenHash,
      ...(args as { projectId: string }),
    }),
  get_task: (ctx, tokenHash, args) =>
    ctx.runQuery(internal.mcpTools.getTask, {
      tokenHash,
      ...(args as { taskId: string; includeComments?: boolean }),
    }),
  list_members: (ctx, tokenHash, args) =>
    ctx.runQuery(internal.mcpTools.listMembers, {
      tokenHash,
      ...(args as { projectId: string }),
    }),
  create_task: (ctx, tokenHash, args) =>
    ctx.runMutation(internal.mcpTools.createTaskTool, {
      tokenHash,
      ...(args as { projectId: string; title: string; statusId?: string }),
    }),
  update_task: (ctx, tokenHash, args) =>
    ctx.runMutation(internal.mcpTools.updateTaskTool, {
      tokenHash,
      ...(args as { taskId: string; title?: string; assigneeId?: string | null }),
    }),
  move_task: (ctx, tokenHash, args) =>
    ctx.runMutation(internal.mcpTools.moveTaskTool, {
      tokenHash,
      ...(args as {
        taskId: string;
        statusId: string;
        previousTaskId?: string;
        nextTaskId?: string;
      }),
    }),
  assign_task: (ctx, tokenHash, args) =>
    ctx.runMutation(internal.mcpTools.assignTaskTool, {
      tokenHash,
      ...(args as { taskId: string; assigneeId: string | null }),
    }),
  list_comments: (ctx, tokenHash, args) =>
    ctx.runQuery(internal.mcpTools.listComments, {
      tokenHash,
      ...(args as { taskId: string }),
    }),
  add_comment: (ctx, tokenHash, args) =>
    ctx.runMutation(internal.mcpTools.addComment, {
      tokenHash,
      ...(args as { taskId: string; text: string }),
    }),
  search: (ctx, tokenHash, args) =>
    ctx.runQuery(internal.mcpTools.search, {
      tokenHash,
      ...(args as { query: string; organizationId?: string; limit?: number }),
    }),
};

async function runTool(
  ctx: ActionCtx,
  tokenHash: string,
  name: string,
  args: ToolArgs,
): Promise<ToolOutcome> {
  const handler = TOOL_HANDLERS[name];
  if (!handler) {
    return { ok: false, error: `Nástroj ${name} neexistuje.` };
  }
  try {
    return { ok: true, value: await handler(ctx, tokenHash, args) };
  } catch (error) {
    if (error instanceof ConvexError) {
      return { ok: false, error: String(error.data) };
    }
    console.error(`MCP tool ${name} failed`, error);
    return { ok: false, error: "Akce se nepovedla." };
  }
}

function json(
  body: unknown,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, ...headers, "Content-Type": "application/json" },
  });
}

function methodNotAllowed(): Response {
  return new Response(null, {
    status: 405,
    headers: { ...CORS_HEADERS, Allow: "POST, GET, OPTIONS" },
  });
}
