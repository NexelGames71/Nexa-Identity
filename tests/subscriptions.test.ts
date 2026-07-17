import { beforeAll, describe, expect, it } from "vitest";

process.env.APP_ENV = "testing";
process.env.DATABASE_URL = "postgresql://nexa_identity:nexa_identity@localhost:5432/nexa_identity?schema=public";
process.env.JWT_ACCESS_SECRET = "test-access-secret-with-at-least-thirty-two-chars";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-with-at-least-thirty-two-chars";
process.env.BILLING_PROVIDER = "manual";

let getBillingReadiness: typeof import("../src/subscriptions/subscription.service.js").getBillingReadiness;
let listPlans: typeof import("../src/subscriptions/subscription.service.js").listPlans;

beforeAll(async () => {
  const service = await import("../src/subscriptions/subscription.service.js");
  getBillingReadiness = service.getBillingReadiness;
  listPlans = service.listPlans;
});

describe("subscription planning", () => {
  it("exposes all initial Nexa plans", () => {
    expect(listPlans().map((plan) => plan.id)).toEqual(["free", "plus", "pro", "premium", "business"]);
  });

  it("reports manual billing readiness honestly", () => {
    expect(getBillingReadiness()).toEqual({
      provider: "manual",
      checkoutEnabled: false,
      manualAssignmentEnabled: true,
      missingConfiguration: []
    });
  });
});
