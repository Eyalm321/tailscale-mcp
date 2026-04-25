import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppConfig } from "../../config/env.js";
import type { AppLogger } from "../../observability/logger.js";
import type { TailscaleService } from "../../tailscale/service.js";

export interface ToolContext {
  config: AppConfig;
  logger: AppLogger;
  tailscale: TailscaleService;
}

export type ServerWithTools = McpServer;
