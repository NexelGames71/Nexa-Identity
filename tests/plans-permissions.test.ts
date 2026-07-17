import { describe, expect, it } from "vitest";
import { getPlan } from "../src/products/plan.service.js";
import { isKnownPermissionScope } from "../src/permissions/scopes.js";

describe("plans", () => {
  it("falls back to free for unknown plans", () => {
    expect(getPlan("unknown").id).toBe("free");
  });

  it("keeps browser access available in the free plan", () => {
    expect(getPlan("free").features).toContain("browser_login");
  });
});

describe("permission scopes", () => {
  it("accepts known privacy-sensitive browser scopes", () => {
    expect(isKnownPermissionScope("browser.read_current_page")).toBe(true);
    expect(isKnownPermissionScope("ai.training_opt_in")).toBe(true);
  });

  it("rejects unknown scopes", () => {
    expect(isKnownPermissionScope("browser.delete_everything")).toBe(false);
  });
});
