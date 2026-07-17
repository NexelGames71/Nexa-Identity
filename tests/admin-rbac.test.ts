import { describe, expect, it } from "vitest";
import { isAdminPermission, permissionsForRole, roleHasPermission } from "../src/admin/services/admin-permission.service.js";

describe("admin RBAC", () => {
  it("gives owner all admin permissions", () => {
    expect(roleHasPermission("owner", "admin.admins.manage")).toBe(true);
    expect(roleHasPermission("owner", "admin.entitlements.update")).toBe(true);
  });

  it("keeps support role away from entitlement changes", () => {
    expect(roleHasPermission("support", "admin.users.view")).toBe(true);
    expect(roleHasPermission("support", "admin.entitlements.update")).toBe(false);
  });

  it("allows security role to revoke sessions but not change plans", () => {
    expect(roleHasPermission("security", "admin.sessions.revoke")).toBe(true);
    expect(roleHasPermission("security", "admin.entitlements.update")).toBe(false);
  });

  it("can merge custom permissions with role defaults", () => {
    expect(permissionsForRole("support", ["admin.beta.update"])).toContain("admin.beta.update");
  });

  it("rejects unknown custom admin permissions", () => {
    expect(isAdminPermission("admin.users.view")).toBe(true);
    expect(isAdminPermission("admin.secrets.dump")).toBe(false);
  });
});
