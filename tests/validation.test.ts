import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  requestPasswordResetSchema
} from "../src/auth/auth.schemas.js";
import { redactMetadata } from "../src/utils/redact.js";

describe("auth validation", () => {
  it("normalizes registration email and rejects weak or malformed registration input", () => {
    const parsed = registerSchema.parse({
      email: "USER@EXAMPLE.COM",
      username: "nexa.user",
      password: "long-enough-password",
      displayName: "Nexa User"
    });

    expect(parsed.email).toBe("user@example.com");
    expect(() =>
      registerSchema.parse({
        email: "user@example.com",
        username: "bad space",
        password: "short",
        displayName: "Nexa User"
      })
    ).toThrow();
  });

  it("accepts email or username login identifiers", () => {
    expect(loginSchema.parse({ identifier: "nexa.user", password: "x" }).identifier).toBe("nexa.user");
    expect(loginSchema.parse({ identifier: "user@example.com", password: "x" }).identifier).toBe("user@example.com");
  });

  it("validates password change and reset request inputs", () => {
    expect(() => changePasswordSchema.parse({ currentPassword: "old", newPassword: "short" })).toThrow();
    expect(requestPasswordResetSchema.parse({ email: "RESET@EXAMPLE.COM" }).email).toBe("reset@example.com");
  });
});

describe("metadata redaction", () => {
  it("removes sensitive values recursively before audit logging", () => {
    expect(
      redactMetadata({
        password: "secret",
        nested: { refreshToken: "token", harmless: "value" },
        list: [{ apiKey: "key" }]
      })
    ).toEqual({
      password: "[redacted]",
      nested: { refreshToken: "[redacted]", harmless: "value" },
      list: [{ apiKey: "[redacted]" }]
    });
  });
});
