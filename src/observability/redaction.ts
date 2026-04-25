const secretPatterns: RegExp[] = [
  /(tskey-[A-Za-z0-9_-]+)/g,
  /(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi,
  /(--authkey(?:=|\s+))[^\s]+/gi,
  /("?(?:apiKey|authKey|accessToken|clientSecret|authorization)"?\s*:\s*")([^"]+)(")/gi,
];

export function redact(value: unknown): string {
  const input =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);

  return secretPatterns.reduce((text, pattern) => {
    if (pattern.source.startsWith("(tskey-")) {
      return text.replace(pattern, "[REDACTED]");
    }
    if (pattern.source.includes("apiKey")) {
      return text.replace(pattern, "$1[REDACTED]$3");
    }
    return text.replace(pattern, "$1[REDACTED]");
  }, input);
}
