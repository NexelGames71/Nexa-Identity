import { describe, expect, it } from "vitest";
import { getConfigurationReadiness } from "../src/system/readiness.service.js";

describe("readiness checks", () => {
  it("reports the production domain CORS check without exposing secrets", () => {
    const checks = getConfigurationReadiness();
    const cors = checks.find((check) => check.name === "cors");

    expect(cors?.status).toBe("ok");
    expect(JSON.stringify(checks)).not.toContain(process.env.JWT_ACCESS_SECRET);
    expect(JSON.stringify(checks)).not.toContain(process.env.DATABASE_URL);
  });

  it("reports local development as degraded rather than production-ready", () => {
    const environment = getConfigurationReadiness().find((check) => check.name === "environment");

    expect(environment?.status).toBe("degraded");
  });
});
