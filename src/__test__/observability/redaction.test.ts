import { describe, expect, test } from "bun:test";
import { redact } from "../../observability/redaction.js";

describe("redact", () => {
  test("redacts auth keys and bearer tokens", () => {
    const text =
      "tailscale up --authkey tskey-auth-1234567890abcdef Authorization: Bearer secret.token.value";

    const redacted = redact(text);

    expect(redacted).not.toContain("tskey-auth-1234567890abcdef");
    expect(redacted).not.toContain("secret.token.value");
    expect(redacted).toContain("--authkey [REDACTED]");
    expect(redacted).toContain("Bearer [REDACTED]");
  });
});
