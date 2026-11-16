import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { type ErrorRequestHandler, type Express } from "express";
import { createMcpServer } from "../../app/create-server.js";
import type { AppConfig } from "../../config/env.js";
import type { AppLogger } from "../../observability/logger.js";
import { createHttpAuthMiddleware } from "../../security/auth.js";
import { createRateLimitMiddleware } from "../../security/rate-limit.js";
import { TailscaleService } from "../../tailscale/service.js";

/**
 * Turns any error that reaches express into a JSON-RPC error response instead
 * of express's default HTML error page (which includes a stack trace outside
 * production). Never echoes the error message or stack.
 * - body is not valid JSON: 400, -32700 "Parse error"
 * - any other 4xx error (e.g. 413 body too large, 415): that status, -32600
 * - anything else: 500, -32603
 */
export const jsonRpcErrorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  next,
) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const { type, status } = (error ?? {}) as {
    type?: unknown;
    status?: unknown;
  };
  let httpStatus = 500;
  let rpcError = { code: -32603, message: "Internal error" };
  if (type === "entity.parse.failed") {
    httpStatus = 400;
    rpcError = { code: -32700, message: "Parse error" };
  } else if (
    typeof status === "number" &&
    Number.isInteger(status) &&
    status >= 400 &&
    status < 500
  ) {
    httpStatus = status;
    rpcError = { code: -32600, message: "Invalid Request" };
  }

  res.status(httpStatus).json({ jsonrpc: "2.0", error: rpcError, id: null });
};

export function createHttpApp({
  config,
  logger,
  tailscale,
}: {
  config: AppConfig;
  logger: AppLogger;
  tailscale: TailscaleService;
}): Express {
  const app = createMcpExpressApp();

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(createRateLimitMiddleware());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/mcp", createHttpAuthMiddleware(config));

  app.post("/mcp", async (req, res) => {
    const server = await createMcpServer({ config, logger, tailscale });
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error("HTTP MCP request failed", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    } finally {
      await transport.close();
      await server.close();
    }
  });

  app.get("/mcp", (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed" },
      id: null,
    });
  });

  app.delete("/mcp", (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed" },
      id: null,
    });
  });

  // Last in the stack, so it also catches errors from the SDK's JSON parser,
  // the rate limiter, auth and the routes above.
  app.use(jsonRpcErrorHandler);

  return app;
}

export async function startHttpTransport({
  config,
  logger,
}: {
  config: AppConfig;
  logger: AppLogger;
}): Promise<void> {
  const tailscale = await TailscaleService.create({ config, logger });
  const app = createHttpApp({ config, logger, tailscale });

  await new Promise<void>((resolve, reject) => {
    const server = app.listen(
      config.MCP_HTTP_PORT,
      config.MCP_HTTP_BIND_HOST,
      () => {
        logger.info("HTTP transport listening", {
          host: config.MCP_HTTP_BIND_HOST,
          port: config.MCP_HTTP_PORT,
        });
        resolve();
      },
    );
    server.on("error", reject);
  });
}
