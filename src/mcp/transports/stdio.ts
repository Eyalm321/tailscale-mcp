import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { AppLogger } from "../../observability/logger.js";

export async function startStdioTransport({
  server,
  logger,
}: {
  server: McpServer;
  logger: AppLogger;
}): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.debug("stdio transport connected");
}
