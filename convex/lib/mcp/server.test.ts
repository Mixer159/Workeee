import { describe, expect, test, vi } from "vitest";
import {
  handleMcpPayload,
  JSON_RPC_ERRORS,
  SUPPORTED_PROTOCOL_VERSIONS,
  type CallTool,
} from "./server";
import { taskContentText } from "./taskText";
import { MCP_TOOLS } from "./tools";

const ok: CallTool = async (name, args) => ({ ok: true, value: { name, args } });

function request(method: string, params?: unknown, id: number | string = 1) {
  return { jsonrpc: "2.0", id, method, params };
}

describe("the MCP protocol", () => {
  test("initialize echoes a supported version and offers tools only", async () => {
    const response = await handleMcpPayload(
      request("initialize", { protocolVersion: "2025-03-26", capabilities: {} }),
      ok,
    );
    expect(response).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "workeee" },
      },
    });
  });

  test("an unknown version gets the newest one", async () => {
    const response = await handleMcpPayload(
      request("initialize", { protocolVersion: "1999-01-01" }),
      ok,
    );
    expect(response).toMatchObject({
      result: { protocolVersion: SUPPORTED_PROTOCOL_VERSIONS[0] },
    });
  });

  test("notifications and client responses get no answer", async () => {
    expect(
      await handleMcpPayload(
        { jsonrpc: "2.0", method: "notifications/initialized" },
        ok,
      ),
    ).toBeNull();
    expect(
      await handleMcpPayload({ jsonrpc: "2.0", id: 7, result: {} }, ok),
    ).toBeNull();
  });

  test("tools/list returns the whole catalog with object schemas", async () => {
    const response = await handleMcpPayload(request("tools/list"), ok);
    const tools = (response as { result: { tools: typeof MCP_TOOLS } }).result.tools;
    expect(tools.map((tool) => tool.name)).toEqual([
      "sync_bot_identity",
      "list_organizations",
      "list_projects",
      "list_tasks",
      "get_task",
      "list_members",
      "create_task",
      "update_task",
      "move_task",
      "assign_task",
      "list_comments",
      "add_comment",
      "search",
    ]);
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe("object");
      for (const key of tool.inputSchema.required ?? []) {
        expect(tool.inputSchema.properties).toHaveProperty(key);
      }
    }
  });

  test("tools/call hands checked arguments to the executor", async () => {
    const callTool = vi.fn(ok);
    const response = await handleMcpPayload(
      request("tools/call", {
        name: "create_task",
        arguments: { projectId: "p1", title: "Opravit" },
      }),
      callTool,
    );
    expect(callTool).toHaveBeenCalledWith("create_task", {
      projectId: "p1",
      title: "Opravit",
    });
    expect(response).toMatchObject({
      result: { content: [{ type: "text" }] },
    });
    expect(response).not.toHaveProperty("result.isError");
  });

  test("bad arguments are a tool error the model can read, never a call", async () => {
    const callTool = vi.fn(ok);
    for (const args of [
      {},
      { projectId: 1, title: "x" },
      { projectId: "p1", title: "x", extra: true },
    ]) {
      const response = await handleMcpPayload(
        request("tools/call", { name: "create_task", arguments: args }),
        callTool,
      );
      expect(response).toMatchObject({ result: { isError: true } });
    }
    expect(callTool).not.toHaveBeenCalled();
  });

  test("assigneeId may be null, and nothing else but a string", async () => {
    const callTool = vi.fn(ok);
    await handleMcpPayload(
      request("tools/call", {
        name: "assign_task",
        arguments: { taskId: "t1", assigneeId: null },
      }),
      callTool,
    );
    expect(callTool).toHaveBeenCalledWith("assign_task", {
      taskId: "t1",
      assigneeId: null,
    });
  });

  test("a refused tool is a result with isError, carrying the sentence", async () => {
    const response = await handleMcpPayload(
      request("tools/call", { name: "list_organizations" }),
      async () => ({ ok: false, error: "Nemáte přístup k této organizaci." }),
    );
    expect(response).toEqual({
      jsonrpc: "2.0",
      id: 1,
      result: {
        content: [{ type: "text", text: "Nemáte přístup k této organizaci." }],
        isError: true,
      },
    });
  });

  test("unknown tools and methods are JSON-RPC errors", async () => {
    expect(
      await handleMcpPayload(request("tools/call", { name: "drop_tables" }), ok),
    ).toMatchObject({ error: { code: JSON_RPC_ERRORS.invalidParams } });
    expect(await handleMcpPayload(request("sampling/createMessage"), ok)).toMatchObject({
      error: { code: JSON_RPC_ERRORS.methodNotFound },
    });
    expect(await handleMcpPayload({ id: 1, method: "ping" }, ok)).toMatchObject({
      error: { code: JSON_RPC_ERRORS.invalidRequest },
    });
  });

  test("a batch answers every request and skips notifications", async () => {
    const response = await handleMcpPayload(
      [
        request("ping", undefined, "a"),
        { jsonrpc: "2.0", method: "notifications/initialized" },
        request("ping", undefined, "b"),
      ],
      ok,
    );
    expect(response).toEqual([
      { jsonrpc: "2.0", id: "a", result: {} },
      { jsonrpc: "2.0", id: "b", result: {} },
    ]);
  });
});

describe("taskContentText", () => {
  test("one line per block, nested blocks indented, links reduced to text", () => {
    const text = taskContentText([
      { type: "heading", content: [{ type: "text", text: "Cíl" }], children: [] },
      {
        type: "bulletListItem",
        content: [
          { type: "text", text: "Viz " },
          { type: "link", href: "https://x", content: [{ type: "text", text: "zadání" }] },
        ],
        children: [
          { type: "paragraph", content: [{ type: "text", text: "detail" }], children: [] },
        ],
      },
      { type: "image", props: { url: "https://x/y.png" }, children: [] },
    ]);
    expect(text).toBe("Cíl\nViz zadání\n  detail");
  });
});
