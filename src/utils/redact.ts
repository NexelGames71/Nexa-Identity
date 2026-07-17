const sensitiveKeys = new Set(["password", "token", "refreshToken", "accessToken", "secret", "apiKey"]);

export function redactMetadata(input: unknown): unknown {
  if (!input || typeof input !== "object") {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(redactMetadata);
  }

  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [
      key,
      sensitiveKeys.has(key) ? "[redacted]" : redactMetadata(value)
    ])
  );
}
