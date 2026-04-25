import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { jsonContent, toMcpError } from "../../observability/errors.js";
import { requireRisk } from "../../security/scopes.js";
import {
  DevicesOutputSchema,
  MessageOutputSchema,
} from "../schemas/tool-results.js";
import type { ServerWithTools, ToolContext } from "./types.js";

const ListDevicesInputSchema = z.object({
  includeRoutes: z.boolean().default(false),
  includeOffline: z.boolean().default(true),
});

const DeviceActionInputSchema = z.object({
  deviceId: z.string().min(1),
  action: z.enum(["authorize", "deauthorize", "delete", "expire-key"]),
});

const ManageRoutesInputSchema = z.object({
  deviceId: z.string().min(1),
  routes: z.array(z.string().min(1)).min(1),
  action: z.enum(["enable", "disable"]),
});

export function registerDeviceTools(
  server: ServerWithTools,
  context: ToolContext,
): void {
  server.registerTool(
    "list_devices",
    {
      title: "List Devices",
      description: "List devices in the configured Tailscale tailnet.",
      inputSchema: ListDevicesInputSchema,
      outputSchema: DevicesOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async (input): Promise<CallToolResult> => {
      try {
        requireRisk(context.config, "read");
        const devices = await context.tailscale.listDevices(input);
        const visibleDevices = input.includeRoutes
          ? devices
          : devices.map(
              ({ advertisedRoutes, enabledRoutes, ...device }) => device,
            );

        return {
          structuredContent: { devices: visibleDevices },
          content: jsonContent({ devices: visibleDevices }),
        };
      } catch (error) {
        return toMcpError(error);
      }
    },
  );

  server.registerTool(
    "device_action",
    {
      title: "Device Action",
      description: "Authorize, deauthorize, delete, or expire a device key.",
      inputSchema: DeviceActionInputSchema,
      outputSchema: MessageOutputSchema,
      annotations: { destructiveHint: true },
    },
    async (input): Promise<CallToolResult> => {
      try {
        requireRisk(
          context.config,
          input.action === "delete" || input.action === "deauthorize"
            ? "admin"
            : "write",
        );
        const message = await context.tailscale.deviceAction(
          input.deviceId,
          input.action,
        );
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
    "manage_routes",
    {
      title: "Manage Routes",
      description: "Enable or disable advertised routes for a device.",
      inputSchema: ManageRoutesInputSchema,
      outputSchema: MessageOutputSchema,
      annotations: { destructiveHint: false },
    },
    async (input): Promise<CallToolResult> => {
      try {
        requireRisk(context.config, "write");
        const message = await context.tailscale.manageRoutes(
          input.deviceId,
          input.routes,
          input.action === "enable",
        );
        return {
          structuredContent: { message },
          content: jsonContent({ message }),
        };
      } catch (error) {
        return toMcpError(error);
      }
    },
  );
}
