import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { jsonContent, toMcpError } from "../../observability/errors.js";
import { requireRisk } from "../../security/scopes.js";
import {
  DataOutputSchema,
  MessageOutputSchema,
  TailnetOutputSchema,
} from "../schemas/tool-results.js";
import type { ServerWithTools, ToolContext } from "./types.js";

export function registerAdminTools(
  server: ServerWithTools,
  context: ToolContext,
): void {
  server.registerTool(
    "get_tailnet_info",
    {
      title: "Get Tailnet Info",
      description: "Get detailed information about the configured tailnet.",
      inputSchema: z.object({ includeDetails: z.boolean().default(false) }),
      outputSchema: TailnetOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async (): Promise<CallToolResult> => {
      try {
        requireRisk(context.config, "read");
        const tailnet = await context.tailscale.getTailnetSummary();
        return {
          structuredContent: { tailnet },
          content: jsonContent({ tailnet }),
        };
      } catch (error) {
        return toMcpError(error);
      }
    },
  );

  server.registerTool(
    "manage_file_sharing",
    {
      title: "Manage File Sharing",
      description: "Read or update tailnet file sharing settings.",
      inputSchema: z.object({
        operation: z.enum(["get_status", "enable", "disable"]),
      }),
      outputSchema: DataOutputSchema,
    },
    async (input): Promise<CallToolResult> => {
      try {
        requireRisk(
          context.config,
          input.operation === "get_status" ? "read" : "write",
        );
        const result =
          input.operation === "get_status"
            ? await context.tailscale.api.getTailnetSettings()
            : await context.tailscale.api.setTailnetSettings({
                fileSharing: input.operation === "enable",
              });
        if (!result.success) {
          throw new Error(result.error ?? "File sharing operation failed");
        }
        const data = result.data ?? {
          message: `File sharing ${input.operation === "enable" ? "enabled" : "disabled"}`,
        };
        return { structuredContent: { data }, content: jsonContent({ data }) };
      } catch (error) {
        return toMcpError(error);
      }
    },
  );

  server.registerTool(
    "manage_exit_nodes",
    {
      title: "Manage Exit Nodes",
      description: "List exit nodes, set local exit node, or advertise routes.",
      inputSchema: z.object({
        operation: z.enum([
          "list",
          "set",
          "clear",
          "advertise",
          "stop_advertising",
        ]),
        deviceId: z.string().optional(),
        routes: z.array(z.string()).optional(),
      }),
      outputSchema: DataOutputSchema,
    },
    async (input): Promise<CallToolResult> => {
      try {
        requireRisk(
          context.config,
          input.operation === "list" ? "read" : "admin",
        );

        if (input.operation === "list") {
          const devices = await context.tailscale.listDevices();
          const data = devices.filter((device) => {
            return (
              device.advertisedRoutes.includes("0.0.0.0/0") ||
              device.advertisedRoutes.includes("::/0")
            );
          });
          return {
            structuredContent: { data },
            content: jsonContent({ data }),
          };
        }

        const message =
          input.operation === "clear"
            ? await context.tailscale.cli.setExitNode().then(readCliMessage)
            : input.operation === "set"
              ? await context.tailscale.cli
                  .setExitNode(input.deviceId)
                  .then(readCliMessage)
              : await context.tailscale.manageRoutes(
                  input.deviceId ?? "",
                  input.routes ?? ["0.0.0.0/0", "::/0"],
                  input.operation === "advertise",
                );

        return {
          structuredContent: { data: { message } },
          content: jsonContent({ data: { message } }),
        };
      } catch (error) {
        return toMcpError(error);
      }
    },
  );

  server.registerTool(
    "manage_webhooks",
    {
      title: "Manage Webhooks",
      description: "List, create, test, or delete Tailscale webhooks.",
      inputSchema: z.object({
        operation: z.enum(["list", "create", "delete", "test"]),
        webhookId: z.string().optional(),
        config: z.record(z.string(), z.unknown()).optional(),
      }),
      outputSchema: DataOutputSchema,
    },
    async (input): Promise<CallToolResult> => {
      try {
        requireRisk(
          context.config,
          input.operation === "list" ? "read" : "write",
        );
        const result =
          input.operation === "list"
            ? await context.tailscale.api.listWebhooks()
            : input.operation === "create"
              ? await context.tailscale.api.createWebhook(input.config ?? {})
              : input.operation === "test" && input.webhookId
                ? await context.tailscale.api.testWebhook(input.webhookId)
                : input.operation === "delete" && input.webhookId
                  ? await context.tailscale.api.deleteWebhook(input.webhookId)
                  : { success: false, error: "webhookId is required" };
        if (!result.success) {
          throw new Error(result.error ?? "Webhook operation failed");
        }
        const data = result.data ?? { message: "Webhook operation completed" };
        return { structuredContent: { data }, content: jsonContent({ data }) };
      } catch (error) {
        return toMcpError(error);
      }
    },
  );

  server.registerTool(
    "manage_device_tags",
    {
      title: "Manage Device Tags",
      description: "Read or update tags for a device.",
      inputSchema: z.object({
        operation: z.enum(["get_tags", "set_tags", "add_tags", "remove_tags"]),
        deviceId: z.string(),
        tags: z.array(z.string()).optional(),
      }),
      outputSchema: DataOutputSchema,
    },
    async (input): Promise<CallToolResult> => {
      try {
        requireRisk(
          context.config,
          input.operation === "get_tags" ? "read" : "write",
        );
        const device = await context.tailscale.getDevice(input.deviceId);
        if (input.operation === "get_tags") {
          return {
            structuredContent: { data: { tags: device.tags } },
            content: jsonContent({ data: { tags: device.tags } }),
          };
        }

        const nextTags =
          input.operation === "set_tags"
            ? (input.tags ?? [])
            : input.operation === "add_tags"
              ? [...new Set([...device.tags, ...(input.tags ?? [])])]
              : device.tags.filter((tag) => !(input.tags ?? []).includes(tag));

        const result = await context.tailscale.api.setDeviceTags(
          input.deviceId,
          nextTags,
        );
        if (!result.success) {
          throw new Error(result.error ?? "Device tag operation failed");
        }

        return {
          structuredContent: { data: { tags: nextTags } },
          content: jsonContent({ data: { tags: nextTags } }),
        };
      } catch (error) {
        return toMcpError(error);
      }
    },
  );

  server.registerTool(
    "get_version_info",
    {
      title: "Get Server Version Info",
      description: "Compatibility alias for server version details.",
      inputSchema: z.object({}),
      outputSchema: MessageOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async (): Promise<CallToolResult> => {
      const message = "tailscale-mcp-server";
      return {
        structuredContent: { message },
        content: jsonContent({ message }),
      };
    },
  );
}

function readCliMessage(result: {
  success: boolean;
  data?: string;
  error?: string;
}) {
  if (!result.success) {
    throw new Error(result.error ?? "CLI operation failed");
  }
  return result.data ?? "Operation completed";
}
