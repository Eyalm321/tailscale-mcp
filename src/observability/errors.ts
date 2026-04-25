import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export class AppError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 500,
    readonly safeMessage = "Operation failed",
  ) {
    super(message);
  }
}

export function toMcpError(error: unknown): CallToolResult {
  if (error instanceof AppError) {
    return {
      isError: true,
      structuredContent: { error: { code: error.code } },
      content: [{ type: "text", text: error.safeMessage }],
    };
  }

  if (error instanceof Error) {
    return {
      isError: true,
      structuredContent: { error: { code: "operation_failed" } },
      content: [{ type: "text", text: error.message }],
    };
  }

  return {
    isError: true,
    structuredContent: { error: { code: "internal_error" } },
    content: [{ type: "text", text: "Operation failed" }],
  };
}

export function jsonContent(value: unknown) {
  return [{ type: "text" as const, text: JSON.stringify(value, null, 2) }];
}
