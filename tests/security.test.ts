import { describe, expect, it } from "vitest";
import { createPlainApiKey, apiKeyPrefix } from "../src/api-keys/api-key.service.js";
import { sha256 } from "../src/security/hash.js";
import { hashPassword, verifyPassword } from "../src/security/password.js";
import { addDuration, durationToMs } from "../src/utils/time.js";

describe("security primitives", () => {
  it("hashes passwords without storing the original value", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(hash).not.toContain("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("hashes tokens deterministically", () => {
    expect(sha256("token")).toEqual(sha256("token"));
    expect(sha256("token")).not.toEqual("token");
  });

  it("creates recognizable API keys and non-secret prefixes", () => {
    const key = createPlainApiKey("testing");

    expect(key.startsWith("nexa_sk_test_")).toBe(true);
    expect(apiKeyPrefix(key)).toMatch(/^nexa_sk_test_.{8}$/);
    expect(key.length).toBeGreaterThan(apiKeyPrefix(key).length);
  });

  it("rejects invalid API key formats before lookup", () => {
    expect(() => apiKeyPrefix("not-a-nexa-key")).toThrow("Invalid Nexa API key format.");
  });
});

describe("duration parsing", () => {
  it("converts configured durations into milliseconds and dates", () => {
    expect(durationToMs("15m")).toBe(900000);
    expect(addDuration(new Date("2026-01-01T00:00:00.000Z"), "1h").toISOString()).toBe(
      "2026-01-01T01:00:00.000Z"
    );
  });
});
