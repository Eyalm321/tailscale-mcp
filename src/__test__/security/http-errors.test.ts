import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { loadConfig } from "../../config/env.js";
import {
  createHttpApp,
  jsonRpcErrorHandler,
} from "../../mcp/transports/http.js";
import { createLogger } from "../../observability/logger.js";
import type { TailscaleService } from "../../tailscale/service.js";

describe("HTTP transport error handling", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const config = loadConfig({
      MCP_TRANSPORT: "http",
      MCP_HTTP_BEARER_TOKEN: "test-bearer-token-0123456789abcdef",
      TAILSCALE_API_KEY: "tskey-test",
      LOG_LEVEL: "error",
    });
    const logger = createLogger(config);
    // A malformed body is rejected before any request reaches Tailscale.
    const tailscale = {} as TailscaleService;
    const app = createHttpApp({ config, logger, tailscale });

    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test("malformed JSON gets a JSON-RPC parse error, not an HTML page", async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-bearer-token-0123456789abcdef",
      },
      body: '{"jsonrpc": "2.0", "method": ',
    });

    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
    const text = await response.text();
    expect(text).not.toContain("<html");
    expect(text).not.toContain("at ");
    expect(JSON.parse(text)).toEqual({
      jsonrpc: "2.0",
      error: { code: -32700, message: "Parse error" },
      id: null,
    });
  });

  test("an over-limit body gets 413 with a JSON-RPC Invalid Request", async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer test-bearer-token-0123456789abcdef",
      },
      body: JSON.stringify({ padding: "x".repeat(2 * 1024 * 1024) }),
    });

    expect(response.status).toBe(413);
    const text = await response.text();
    expect(text).not.toContain("<html");
    expect(JSON.parse(text)).toEqual({
      jsonrpc: "2.0",
      error: { code: -32600, message: "Invalid Request" },
      id: null,
    });
  });

  test("health endpoint still answers", async () => {
    const response = await fetch(`${baseUrl}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
  });
});

describe("jsonRpcErrorHandler", () => {
  function run(error: unknown) {
    const sent: { status?: number; body?: unknown } = {};
    const res = {
      headersSent: false,
      status(code: number) {
        sent.status = code;
        return this;
      },
      json(body: unknown) {
        sent.body = body;
        return this;
      },
    };
    jsonRpcErrorHandler(
      error,
      {} as Parameters<typeof jsonRpcErrorHandler>[1],
      res as unknown as Parameters<typeof jsonRpcErrorHandler>[2],
      () => {},
    );
    return sent;
  }

  test("4xx errors keep their status and never echo the message", () => {
    const sent = run(
      Object.assign(new Error("secret detail"), {
        status: 415,
        type: "encoding.unsupported",
      }),
    );
    expect(sent.status).toBe(415);
    expect(sent.body).toEqual({
      jsonrpc: "2.0",
      error: { code: -32600, message: "Invalid Request" },
      id: null,
    });
    expect(JSON.stringify(sent.body)).not.toContain("secret detail");
  });

  test("other errors become a 500 Internal error", () => {
    for (const error of [
      new Error("boom"),
      Object.assign(new Error("x"), { status: 503 }),
      "not an error",
      null,
    ]) {
      const sent = run(error);
      expect(sent.status).toBe(500);
      expect(sent.body).toEqual({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal error" },
        id: null,
      });
    }
  });
});
