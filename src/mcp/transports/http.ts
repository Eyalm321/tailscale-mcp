import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { createMcpServer } from "../../app/create-server.js";
import type { AppConfig } from "../../config/env.js";
import type { AppLogger } from "../../observability/logger.js";
import { createHttpAuthMiddleware } from "../../security/auth.js";
import { createRateLimitMiddleware } from "../../security/rate-limit.js";
import { TailscaleService } from "../../tailscale/service.js";

export async function startHttpTransport({
  config,
  logger,
}: {
  config: AppConfig;
  logger: AppLogger;
}): Promise<void> {
  const tailscale = await TailscaleService.create({ config, logger });
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
