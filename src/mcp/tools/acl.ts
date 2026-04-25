import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { jsonContent, toMcpError } from "../../observability/errors.js";
import { requireRisk } from "../../security/scopes.js";
import {
  DataOutputSchema,
  MessageOutputSchema,
} from "../schemas/tool-results.js";
import type { ServerWithTools, ToolContext } from "./types.js";

const ACLConfigSchema = z.record(z.string(), z.unknown());

const ManageACLInputSchema = z.object({
  operation: z.enum(["get", "update", "validate"]),
  aclConfig: ACLConfigSchema.optional(),
});

const ManageDNSInputSchema = z.object({
  operation: z.enum([
    "get_nameservers",
    "set_nameservers",
    "get_preferences",
    "set_preferences",
    "get_searchpaths",
    "set_searchpaths",
  ]),
  nameservers: z.array(z.string()).optional(),
  magicDNS: z.boolean().optional(),
  searchPaths: z.array(z.string()).optional(),
});

const ManageKeysInputSchema = z.object({
  operation: z.enum(["list", "create", "delete"]),
  keyId: z.string().optional(),
  keyConfig: z.record(z.string(), z.unknown()).optional(),
});

const ManagePolicyInputSchema = z.object({
  operation: z.enum(["get", "update", "test_access"]),
  policy: z.string().optional(),
});

export function registerAclTools(
  server: ServerWithTools,
  context: ToolContext,
): void {
  server.registerTool(
    "manage_acl",
    {
      title: "Manage ACL",
      description: "Read, validate, or update the tailnet ACL policy.",
      inputSchema: ManageACLInputSchema,
      outputSchema: DataOutputSchema,
    },
    async (input): Promise<CallToolResult> => {
      try {
        requireRisk(
          context.config,
          input.operation === "get" ? "read" : "write",
        );

        const result =
          input.operation === "get"
            ? await context.tailscale.api.getACL()
            : input.operation === "validate"
              ? await context.tailscale.api.validateACL(
                  JSON.stringify(input.aclConfig ?? {}, null, 2),
                )
              : await context.tailscale.api.updateACL(
                  JSON.stringify(input.aclConfig ?? {}, null, 2),
                );

        if (!result.success) {
          throw new Error(result.error ?? "ACL operation failed");
        }

        const data =
          input.operation === "update"
            ? { message: "ACL updated" }
            : result.data;
        return { structuredContent: { data }, content: jsonContent({ data }) };
      } catch (error) {
        return toMcpError(error);
      }
    },
  );

  server.registerTool(
    "manage_dns",
    {
      title: "Manage DNS",
      description: "Read or update Tailscale DNS settings.",
      inputSchema: ManageDNSInputSchema,
      outputSchema: DataOutputSchema,
    },
    async (input): Promise<CallToolResult> => {
      try {
        const isRead = input.operation.startsWith("get_");
        requireRisk(context.config, isRead ? "read" : "write");

        const result = await runDnsOperation(input, context);
        if (!result.success) {
          throw new Error(result.error ?? "DNS operation failed");
        }

        const data = result.data ?? { message: "DNS settings updated" };
        return { structuredContent: { data }, content: jsonContent({ data }) };
      } catch (error) {
        return toMcpError(error);
      }
    },
  );

  server.registerTool(
    "manage_keys",
    {
      title: "Manage Auth Keys",
      description: "List, create, or delete Tailscale authentication keys.",
      inputSchema: ManageKeysInputSchema,
      outputSchema: DataOutputSchema,
      annotations: { destructiveHint: true },
    },
    async (input): Promise<CallToolResult> => {
      try {
        requireRisk(
          context.config,
          input.operation === "list" ? "read" : "admin",
        );

        const result =
          input.operation === "list"
            ? await context.tailscale.api.listAuthKeys()
            : input.operation === "create"
              ? await context.tailscale.api.createAuthKey(input.keyConfig ?? {})
              : input.keyId
                ? await context.tailscale.api.deleteAuthKey(input.keyId)
                : { success: false, error: "keyId is required" };

        if (!result.success) {
          throw new Error(result.error ?? "Auth key operation failed");
        }

        const data =
          input.operation === "delete"
            ? { message: `Auth key ${input.keyId} deleted` }
            : result.data;
        return { structuredContent: { data }, content: jsonContent({ data }) };
      } catch (error) {
        return toMcpError(error);
      }
    },
  );

  server.registerTool(
    "manage_policy_file",
    {
      title: "Manage Policy File",
      description: "Read or update the tailnet policy file.",
      inputSchema: ManagePolicyInputSchema,
      outputSchema: DataOutputSchema,
    },
    async (input): Promise<CallToolResult> => {
      try {
        requireRisk(
          context.config,
          input.operation === "get" ? "read" : "write",
        );

        if (input.operation === "update" && !input.policy) {
          throw new Error("policy is required for update");
        }

        const result =
          input.operation === "get"
            ? await context.tailscale.api.getACL()
            : input.operation === "update"
              ? await context.tailscale.api.updateACL(input.policy ?? "")
              : { success: false, error: "test_access is not implemented" };

        if (!result.success) {
          throw new Error(result.error ?? "Policy operation failed");
        }

        const data =
          input.operation === "update"
            ? { message: "Policy updated" }
            : result.data;
        return { structuredContent: { data }, content: jsonContent({ data }) };
      } catch (error) {
        return toMcpError(error);
      }
    },
  );

  server.registerTool(
    "manage_network_lock",
    {
      title: "Manage Network Lock",
      description: "Network lock status and mutation operations.",
      inputSchema: z.object({
        operation: z.enum([
          "status",
          "enable",
          "disable",
          "add_key",
          "remove_key",
          "list_keys",
        ]),
      }),
      outputSchema: MessageOutputSchema,
    },
    async (input): Promise<CallToolResult> => {
      try {
        requireRisk(
          context.config,
          input.operation === "status" ? "read" : "admin",
        );
        const message =
          "Network lock management requires endpoint-specific implementation in this rebuild.";
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

async function runDnsOperation(
  input: z.infer<typeof ManageDNSInputSchema>,
  context: ToolContext,
) {
  switch (input.operation) {
    case "get_nameservers":
      return context.tailscale.api.getDNSNameservers();
    case "set_nameservers":
      return context.tailscale.api.setDNSNameservers(input.nameservers ?? []);
    case "get_preferences":
      return context.tailscale.api.getDNSPreferences();
    case "set_preferences":
      return context.tailscale.api.setDNSPreferences(input.magicDNS ?? true);
    case "get_searchpaths":
      return context.tailscale.api.getDNSSearchPaths();
    case "set_searchpaths":
      return context.tailscale.api.setDNSSearchPaths(input.searchPaths ?? []);
  }
}
