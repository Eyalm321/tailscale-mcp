import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpServer } from "../app/create-server.js";
import { loadConfig } from "../config/env.js";
import { createLogger } from "../observability/logger.js";
import type { TailscaleService } from "../tailscale/service.js";
import { SERVER_VERSION } from "../version.js";

const packageVersion: string = JSON.parse(
  readFileSync(join(import.meta.dir, "../../package.json"), "utf8"),
).version;

describe("server version", () => {
  test("SERVER_VERSION equals package.json version", () => {
    expect(SERVER_VERSION).toBe(packageVersion);
  });

  test("MCP clients see the package version in serverInfo", async () => {
    const config = loadConfig({
      TAILSCALE_API_KEY: "tskey-test",
      LOG_LEVEL: "error",
    });
    const logger = createLogger(config);
    // Registration does not call Tailscale, so an empty stub is enough.
    const tailscale = {} as TailscaleService;
    const server = await createMcpServer({ config, logger, tailscale });
    const client = new Client({ name: "version-test", version: "0.0.0" });
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();

    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    try {
      expect(client.getServerVersion()).toEqual({
        name: "tailscale-mcp-server",
        version: packageVersion,
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});
