import { z } from "zod";
import type { ServerWithTools } from "../tools/types.js";

export function registerPrompts(server: ServerWithTools): void {
  server.registerPrompt(
    "diagnose_tailnet_connectivity",
    {
      title: "Diagnose Tailnet Connectivity",
      description:
        "Guide a safe read-only investigation of tailnet connectivity.",
      argsSchema: {
        sourceDevice: z.string().optional(),
        targetDevice: z.string().optional(),
      },
    },
    async ({ sourceDevice, targetDevice }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              "Diagnose Tailscale connectivity using read-only tools only. " +
              `Source: ${sourceDevice ?? "unspecified"}. ` +
              `Target: ${targetDevice ?? "unspecified"}.`,
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "review_acl_change",
    {
      title: "Review ACL Change",
      description:
        "Review a proposed ACL or policy change for least privilege risks.",
      argsSchema: {
        proposedPolicy: z.string().describe("Proposed ACL or policy content."),
        goal: z.string().optional(),
      },
    },
    async ({ proposedPolicy, goal }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              "Review this Tailscale ACL/policy change for correctness, " +
              "least privilege, tests, SSH exposure, tag ownership, and " +
              `device posture impact. Goal: ${goal ?? "unspecified"}.\n\n` +
              proposedPolicy,
          },
        },
      ],
    }),
  );
}
