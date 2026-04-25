import { registerAclTools } from "./acl.js";
import { registerAdminTools } from "./admin.js";
import { registerDeviceTools } from "./devices.js";
import { registerNetworkTools } from "./network.js";
import type { ServerWithTools, ToolContext } from "./types.js";

export function registerTools(
  server: ServerWithTools,
  context: ToolContext,
): void {
  registerDeviceTools(server, context);
  registerNetworkTools(server, context);
  registerAclTools(server, context);
  registerAdminTools(server, context);
}

export type { ToolContext };
