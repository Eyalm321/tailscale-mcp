import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { jsonContent, toMcpError } from "../../observability/errors.js";
import { requireRisk } from "../../security/scopes.js";
import {
  MessageOutputSchema,
  NetworkStatusOutputSchema,
} from "../schemas/tool-results.js";
import type { ServerWithTools, ToolContext } from "./types.js";

const NetworkStatusInputSchema = z.object({
  format: z.enum(["json", "summary"]).default("json"),
});

const ConnectNetworkInputSchema = z.object({
  acceptRoutes: z.boolean().default(false),
  acceptDNS: z.boolean().default(false),
  hostname: z.string().optional(),
  advertiseRoutes: z.array(z.string()).optional(),
  authKey: z.string().optional(),
  loginServer: z.string().optional(),
});

const PingPeerInputSchema = z.object({
  target: z.string().min(1),
  count: z.number().int().min(1).max(100).default(4),
});

export function registerNetworkTools(
  server: ServerWithTools,
  context: ToolContext,
): void {
  server.registerTool(
    "get_network_status",
    {
      title: "Get Network Status",
      description: "Get current Tailscale network status.",
      inputSchema: NetworkStatusInputSchema,
      outputSchema: NetworkStatusOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async (): Promise<CallToolResult> => {
      try {
        requireRisk(context.config, "read");
        const status = await context.tailscale.getNetworkStatus();
        return {
          structuredContent: { status },
          content: jsonContent({ status }),
        };
      } catch (error) {
        return toMcpError(error);
      }
    },
  );

  server.registerTool(
    "connect_network",
    {
      title: "Connect Network",
      description: "Connect this host to Tailscale with optional CLI flags.",
      inputSchema: ConnectNetworkInputSchema,
      outputSchema: MessageOutputSchema,
    },
    async (input): Promise<CallToolResult> => {
      try {
        requireRisk(context.config, "admin");
        const message = await context.tailscale.connect({
          acceptRoutes: input.acceptRoutes,
          acceptDns: input.acceptDNS,
          hostname: input.hostname,
          advertiseRoutes: input.advertiseRoutes,
          authKey: input.authKey,
          loginServer: input.loginServer,
        });
        return {
          structuredContent: { message },
          content: jsonContent({ message }),
        };
      } catch (error) {
        return toMcpError(error);
      }
    },
  );

  server.registerTool(
    "disconnect_network",
    {
      title: "Disconnect Network",
      description: "Disconnect this host from Tailscale.",
      inputSchema: z.object({}),
      outputSchema: MessageOutputSchema,
      annotations: { destructiveHint: true },
    },
    async (): Promise<CallToolResult> => {
      try {
        requireRisk(context.config, "admin");
        const message = await context.tailscale.disconnect();
        return {
          structuredContent: { message },
          content: jsonContent({ message }),
        };
      } catch (error) {
        return toMcpError(error);
      }
    },
  );

  server.registerTool(
    "ping_peer",
    {
      title: "Ping Peer",
      description: "Ping a Tailscale peer through the local Tailscale CLI.",
      inputSchema: PingPeerInputSchema,
      outputSchema: MessageOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async (input): Promise<CallToolResult> => {
      try {
        requireRisk(context.config, "read");
        const message = await context.tailscale.ping(input.target, input.count);
        return {
          structuredContent: { message },
          content: jsonContent({ message }),
        };
      } catch (error) {
        return toMcpError(error);
      }
    },
  );

  server.registerTool(
    "get_version",
    {
      title: "Get Version",
      description: "Get local Tailscale CLI version information.",
      inputSchema: z.object({}),
      outputSchema: MessageOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async (): Promise<CallToolResult> => {
      try {
        requireRisk(context.config, "read");
        const message = await context.tailscale.getVersion();
        return {
          structuredContent: {
            message:
              typeof message === "string" ? message : JSON.stringify(message),
          },
          content: jsonContent({ message }),
        };
      } catch (error) {
        return toMcpError(error);
      }
    },
  );
}
