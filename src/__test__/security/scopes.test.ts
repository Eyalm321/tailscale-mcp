import { describe, expect, test } from "bun:test";
import { requireRisk } from "../../security/scopes.js";

describe("requireRisk", () => {
  test("allows equal or lower risk operations", () => {
    expect(() =>
      requireRisk({ TAILSCALE_ALLOWED_TOOL_RISK: "write" }, "read"),
    ).not.toThrow();
    expect(() =>
      requireRisk({ TAILSCALE_ALLOWED_TOOL_RISK: "write" }, "write"),
    ).not.toThrow();
  });

  test("rejects higher risk operations", () => {
    expect(() =>
      requireRisk({ TAILSCALE_ALLOWED_TOOL_RISK: "read" }, "write"),
    ).toThrow("Tool requires write risk level");
  });
});
