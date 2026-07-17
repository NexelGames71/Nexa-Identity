import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env.js";
import { sendError } from "../../utils/api-response.js";

export function normalizeAdminIp(ip?: string) {
  if (!ip) {
    return "";
  }

  if (ip.startsWith("::ffff:")) {
    return ip.slice("::ffff:".length);
  }

  return ip;
}

export function adminAllowedIps() {
  return env.ADMIN_ALLOWED_IPS.split(",")
    .map((ip) => normalizeAdminIp(ip.trim()))
    .filter(Boolean);
}

function isLoopbackIp(ip: string) {
  return ip === "127.0.0.1" || ip === "::1" || ip === "localhost";
}

export function isAdminIpAllowed(ip?: string) {
  return isAdminIpAllowedWithConfig(ip, {
    allowLan: env.ADMIN_ALLOW_LAN,
    allowedIps: adminAllowedIps()
  });
}

export function isAdminIpAllowedWithConfig(ip: string | undefined, config: { allowLan: boolean; allowedIps: string[] }) {
  const normalizedIp = normalizeAdminIp(ip);
  if (!normalizedIp) {
    return false;
  }

  if (config.allowedIps.length > 0 && config.allowedIps.includes(normalizedIp)) {
    return true;
  }

  if (!config.allowLan) {
    return isLoopbackIp(normalizedIp);
  }

  return config.allowedIps.length === 0;
}

export function requireAdminDashboardAccess(req: Request, res: Response, next: NextFunction) {
  if (!env.ADMIN_DASHBOARD_ENABLED) {
    return sendError(res, 404, "not_found", "Admin dashboard is disabled.");
  }

  if (env.ADMIN_REQUIRE_HTTPS && !req.secure) {
    return sendError(res, 403, "forbidden", "Admin dashboard requires HTTPS.");
  }

  if (!isAdminIpAllowed(req.ip)) {
    return sendError(res, 403, "forbidden", "Admin dashboard is not available from this network.");
  }

  return next();
}
