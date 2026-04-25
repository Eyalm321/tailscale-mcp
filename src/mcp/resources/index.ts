import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { jsonContent } from "../../observability/errors.js";
import type { ServerWithTools, ToolContext } from "../tools/types.js";

export function registerResources(
  server: ServerWithTools,
  context: ToolContext,
): void {
  server.registerResource(
    "tailnet-summary",
    "tailscale://tailnet/summary",
    {
      title: "Tailnet Summary",
      description: "Current tailnet health, DNS, and device summary.",
      mimeType: "application/json",
    },
    async (uri) => {
      const summary = await context.tailscale.getTailnetSummary();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: jsonContent(summary)[0].text,
          },
        ],
      };
    },
  );

  server.registerResource(
    "devices",
    "tailscale://devices",
    {
      title: "Devices",
      description: "All devices visible in the configured tailnet.",
      mimeType: "application/json",
    },
    async (uri) => {
      const devices = await context.tailscale.listDevices();
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: jsonContent({ devices })[0].text,
          },
        ],
      };
    },
  );

  server.registerResource(
    "device",
    new ResourceTemplate("tailscale://devices/{deviceId}", {
      list: undefined,
    }),
    {
      title: "Device",
      description: "A single Tailscale device by ID.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const deviceId = String(variables.deviceId);
      const device = await context.tailscale.getDevice(deviceId);
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: jsonContent({ device })[0].text,
          },
        ],
      };
    },
  );

  server.registerResource(
    "acl-current",
    "tailscale://acl/current",
    {
      title: "Current ACL",
      description: "Current tailnet ACL policy.",
      mimeType: "application/hujson",
    },
    async (uri) => {
      const acl = await context.tailscale.api.getACL();
      if (!acl.success) {
        throw new Error(acl.error ?? "Failed to read ACL");
      }
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/hujson",
            text: String(acl.data ?? ""),
          },
        ],
      };
    },
  );
}
