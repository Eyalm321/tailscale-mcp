import { describe, expect, test } from "bun:test";
import { loadConfig } from "../../config/env.js";

describe("loadConfig", () => {
  test("uses safe stdio defaults with oauth credentials", () => {
    const config = loadConfig({
      TAILSCALE_OAUTH_CLIENT_ID: "client-id",
      TAILSCALE_OAUTH_CLIENT_SECRET: "client-secret",
    });

    expect(config.MCP_TRANSPORT).toBe("stdio");
    expect(config.MCP_HTTP_BIND_HOST).toBe("127.0.0.1");
    expect(config.MCP_HTTP_PORT).toBe(3000);
    expect(config.TAILSCALE_TAILNET).toBe("-");
    expect(config.TAILSCALE_ALLOWED_TOOL_RISK).toBe("read");
  });

  test("rejects missing Tailscale credentials", () => {
    expect(() => loadConfig({})).toThrow(
      "Set OAuth credentials or TAILSCALE_API_KEY",
    );
  });

  test("requires bearer token for HTTP transport", () => {
    expect(() =>
      loadConfig({
        MCP_TRANSPORT: "http",
        TAILSCALE_API_KEY: "tskey-test",
      }),
    ).toThrow("HTTP transport requires MCP_HTTP_BEARER_TOKEN");
  });
});
