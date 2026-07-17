import type { NextFunction, Request, Response } from "express";
import { verifyAdminSession } from "../services/admin-session.service.js";
import { roleHasPermission, type AdminPermission } from "../services/admin-permission.service.js";
import { sendError } from "../../utils/api-response.js";

export async function authenticateAdmin(req: Request, res: Response, next: NextFunction) {
  const header = req.get("authorization");
  const token = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : typeof req.cookies?.nexa_admin_session === "string"
      ? req.cookies.nexa_admin_session
      : undefined;

  if (!token) {
    return sendError(res, 401, "unauthorized", "Admin authentication is required.");
  }

  const session = await verifyAdminSession(token);
  const adminRole = session?.adminUser.adminRoles[0];
  if (!session || !adminRole) {
    return sendError(res, 401, "unauthorized", "Admin session is invalid or expired.");
  }

  req.admin = {
    userId: session.adminUserId,
    role: session.role,
    permissions: adminRole.permissions,
    sessionId: session.id
  };

  return next();
}

export function requireAdminPermission(permission: AdminPermission) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.admin || !roleHasPermission(req.admin.role, permission, req.admin.permissions)) {
      return sendError(res, 403, "forbidden", "Admin permission is required.");
    }

    return next();
  };
}
