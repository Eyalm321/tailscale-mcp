import type { ToolRisk } from "../config/env.js";
import { AppError } from "../observability/errors.js";

const rank: Record<ToolRisk, number> = {
  read: 0,
  write: 1,
  admin: 2,
};

export function requireRisk(
  config: { TAILSCALE_ALLOWED_TOOL_RISK: ToolRisk },
  required: ToolRisk,
): void {
  if (rank[config.TAILSCALE_ALLOWED_TOOL_RISK] < rank[required]) {
    throw new AppError(
      `Tool requires ${required} risk level`,
      "risk_level_denied",
      403,
      `Tool requires ${required} risk level`,
    );
  }
}
