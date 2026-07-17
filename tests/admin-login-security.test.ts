import { describe, expect, it } from "vitest";
import {
  ADMIN_LOCK_AFTER_FAILURES,
  ADMIN_LOCK_DURATION_MS,
  nextAdminLoginFailureState
} from "../src/admin/services/admin-login-security.service.js";

describe("admin login security", () => {
  it("increments failed login count before lock threshold", () => {
    const state = nextAdminLoginFailureState(ADMIN_LOCK_AFTER_FAILURES - 2, new Date("2026-06-26T00:00:00.000Z"));

    expect(state.failedLoginCount).toBe(ADMIN_LOCK_AFTER_FAILURES - 1);
    expect(state.lockedUntil).toBeNull();
  });

  it("locks the account at the admin failure threshold", () => {
    const now = new Date("2026-06-26T00:00:00.000Z");
    const state = nextAdminLoginFailureState(ADMIN_LOCK_AFTER_FAILURES - 1, now);

    expect(state.failedLoginCount).toBe(ADMIN_LOCK_AFTER_FAILURES);
    expect(state.lockedUntil?.getTime()).toBe(now.getTime() + ADMIN_LOCK_DURATION_MS);
  });
});
