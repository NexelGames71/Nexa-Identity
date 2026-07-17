import { describe, expect, it } from "vitest";
import { adminLoginSchema } from "../src/admin/routes/admin-auth.routes.js";

describe("admin auth validation", () => {
  it("accepts email or username-style admin identifiers", () => {
    expect(adminLoginSchema.parse({ identifier: "admin.nexaidentity.com", password: "secret" }).identifier).toBe(
      "admin.nexaidentity.com"
    );
    expect(adminLoginSchema.parse({ identifier: "admin@admin.nexaidentity.com", password: "secret" }).identifier).toBe(
      "admin@admin.nexaidentity.com"
    );
  });

  it("keeps the legacy email field compatible for API clients", () => {
    expect(adminLoginSchema.parse({ email: "admin@admin.nexaidentity.com", password: "secret" }).email).toBe(
      "admin@admin.nexaidentity.com"
    );
  });
});
