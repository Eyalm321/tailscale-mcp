import { describe, expect, test } from "bun:test";
import { isAllowedHost, validateBearerToken } from "../../security/auth.js";

describe("HTTP security", () => {
  test("validates bearer token exactly", () => {
    expect(validateBearerToken("Bearer abc123", "abc123")).toBe(true);
    expect(validateBearerToken("Bearer wrong", "abc123")).toBe(false);
    expect(validateBearerToken(undefined, "abc123")).toBe(false);
  });

  test("allows localhost and tailnet hosts only", () => {
    expect(isAllowedHost("localhost:3000")).toBe(true);
    expect(isAllowedHost("127.0.0.1:3000")).toBe(true);
    expect(isAllowedHost("mcp.tailnet-name.ts.net")).toBe(true);
    expect(isAllowedHost("evil.example.com")).toBe(false);
  });
});
