import { describe, expect, it } from "vitest";
import { isAdminIpAllowedWithConfig, normalizeAdminIp } from "../src/admin/middleware/admin-local-access.js";

describe("admin local access", () => {
  it("normalizes IPv4-mapped IPv6 loopback addresses", () => {
    expect(normalizeAdminIp("::ffff:127.0.0.1")).toBe("127.0.0.1");
  });

  it("allows loopback when LAN mode is disabled", () => {
    expect(isAdminIpAllowedWithConfig("127.0.0.1", { allowLan: false, allowedIps: [] })).toBe(true);
    expect(isAdminIpAllowedWithConfig("::1", { allowLan: false, allowedIps: [] })).toBe(true);
  });

  it("blocks non-loopback addresses unless explicitly allowed", () => {
    expect(isAdminIpAllowedWithConfig("192.168.1.50", { allowLan: false, allowedIps: [] })).toBe(false);
    expect(isAdminIpAllowedWithConfig("192.168.1.50", { allowLan: true, allowedIps: ["192.168.1.50"] })).toBe(true);
  });

  it("does not let LAN mode bypass a configured allowlist", () => {
    expect(isAdminIpAllowedWithConfig("192.168.1.51", { allowLan: true, allowedIps: ["192.168.1.50"] })).toBe(false);
  });
});
