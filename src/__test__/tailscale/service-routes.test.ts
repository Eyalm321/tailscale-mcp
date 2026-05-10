import { describe, expect, test } from "bun:test";
import { loadConfig } from "../../config/env.js";
import type { AppLogger } from "../../observability/logger.js";
import { TailscaleService } from "../../tailscale/service.js";

const logger: AppLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  flush: async () => {},
  close: async () => {},
};

describe("TailscaleService route management", () => {
  test("disables requested routes without removing unrelated enabled routes", async () => {
    const service = await createService();
    const updates: string[][] = [];

    service.api.getDeviceRoutes = async () => ({
      success: true,
      data: {
        advertisedRoutes: ["10.0.0.0/16", "192.168.1.0/24", "0.0.0.0/0"],
        enabledRoutes: ["10.0.0.0/16", "192.168.1.0/24", "0.0.0.0/0"],
      },
    });
    service.api.setDeviceRoutes = async (_deviceId, routes) => {
      updates.push(routes);
      return { success: true, data: {} };
    };

    await service.manageRoutes("node-1", ["0.0.0.0/0"], false);

    expect(updates).toEqual([["10.0.0.0/16", "192.168.1.0/24"]]);
  });

  test("enables requested routes without replacing existing enabled routes", async () => {
    const service = await createService();
    const updates: string[][] = [];

    service.api.getDeviceRoutes = async () => ({
      success: true,
      data: {
        advertisedRoutes: ["10.0.0.0/16", "192.168.1.0/24"],
        enabledRoutes: ["10.0.0.0/16"],
      },
    });
    service.api.setDeviceRoutes = async (_deviceId, routes) => {
      updates.push(routes);
      return { success: true, data: {} };
    };

    await service.manageRoutes("node-1", ["192.168.1.0/24"], true);

    expect(updates).toEqual([["10.0.0.0/16", "192.168.1.0/24"]]);
  });
});

async function createService(): Promise<TailscaleService> {
  return TailscaleService.create({
    config: loadConfig({
      TAILSCALE_API_KEY: "tskey-test",
      TAILSCALE_TAILNET: "-",
    }),
    logger,
  });
}
