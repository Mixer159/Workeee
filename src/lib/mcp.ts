/**
 * Where a bot connects. The MCP endpoint is an HTTP route of the Convex
 * deployment (`convex/mcp.ts`), so it lives on the `.convex.site` host — the
 * same one Better Auth answers on — and not on the Next.js origin.
 */
export function mcpServerUrl(): string {
  const site = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? "";
  return `${site.replace(/\/+$/, "")}/mcp`;
}

/**
 * A ready-to-paste client entry. The shape Cursor's `mcp.json` reads; other
 * clients that take a URL and headers want the same two values.
 */
export function mcpClientConfig(token: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        workeee: {
          url: mcpServerUrl(),
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2,
  );
}
