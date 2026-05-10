import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { loadConfig } from "../../config/env.js";
import type { AppLogger } from "../../observability/logger.js";
import { TailscaleApiClient } from "../../tailscale/api-client.js";

const logger: AppLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  flush: async () => {},
  close: async () => {},
};

describe("TailscaleApiClient", () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; init?: RequestInit }> = [];

  beforeEach(() => {
    requests.length = 0;
    globalThis.fetch = Object.assign(
      async (...args: Parameters<typeof fetch>): Promise<Response> => {
        const [input, init] = args;
        requests.push({ url: String(input), init });
        return Response.json({
          devices: [],
          advertisedRoutes: [],
          enabledRoutes: [],
        });
      },
      { preconnect: originalFetch.preconnect },
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("requests all device fields when route fields are needed", async () => {
    const client = createClient();

    await client.listDevices({ includeRoutes: true });

    expect(requests[0]?.url).toBe(
      "https://api.tailscale.com/api/v2/tailnet/-/devices?fields=all",
    );
  });

  test("uses default device fields when route fields are not needed", async () => {
    const client = createClient();

    await client.listDevices();

    expect(requests[0]?.url).toBe(
      "https://api.tailscale.com/api/v2/tailnet/-/devices",
    );
  });

  test("sets device routes with POST because the API replaces enabled routes", async () => {
    const client = createClient();

    await client.setDeviceRoutes("node-1", ["10.0.0.0/16"]);

    expect(requests[0]?.url).toBe(
      "https://api.tailscale.com/api/v2/device/node-1/routes",
    );
    expect(requests[0]?.init?.method).toBe("POST");
    expect(requests[0]?.init?.body).toBe('{"routes":["10.0.0.0/16"]}');
  });
});

function createClient(): TailscaleApiClient {
  return new TailscaleApiClient(
    loadConfig({
      TAILSCALE_API_KEY: "tskey-test",
      TAILSCALE_TAILNET: "-",
    }),
    logger,
  );
}
