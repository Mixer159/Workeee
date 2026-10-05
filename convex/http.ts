import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";
import { mcpDelete, mcpGet, mcpOptions, mcpPost } from "./mcp";

const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

// The remote MCP server for bots. Deliberately no `/.well-known/oauth-*`
// routes: see `convex/mcp.ts`.
http.route({ path: "/mcp", method: "POST", handler: mcpPost });
http.route({ path: "/mcp", method: "GET", handler: mcpGet });
http.route({ path: "/mcp", method: "DELETE", handler: mcpDelete });
http.route({ path: "/mcp", method: "OPTIONS", handler: mcpOptions });

export default http;
