import { Router } from "express";
import { z } from "zod";
import { auditLog } from "../../audit/audit.service.js";
import { prisma } from "../../config/database.js";
import { isProduction } from "../../config/env.js";
import { verifyPassword } from "../../security/password.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { sendError, sendSuccess } from "../../utils/api-response.js";
import { validateBody } from "../../middleware/validate.js";
import { clearAdminLoginFailures, recordAdminLoginFailure } from "../services/admin-login-security.service.js";
import { getActiveAdminRole } from "../services/admin-role.service.js";
import { createAdminSession, revokeAdminSession } from "../services/admin-session.service.js";
import { authenticateAdmin } from "../middleware/admin-authenticate.js";
import { permissionsForRole } from "../services/admin-permission.service.js";

export const adminAuthRouter = Router();

export const adminLoginSchema = z
  .object({
    identifier: z.string().trim().min(1).optional(),
    email: z.string().trim().min(1).optional(),
    password: z.string().min(1)
  })
  .refine((value) => value.identifier || value.email, "Email or username is required.");

adminAuthRouter.post(
  "/auth/login",
  validateBody(adminLoginSchema),
  asyncHandler(async (req, res) => {
    const identifier = (req.body.identifier ?? req.body.email).trim();
    const normalizedIdentifier = identifier.toLowerCase();
    const user = await prisma.user.findFirst({
      where: { OR: [{ email: normalizedIdentifier }, { username: identifier }] }
    });
    if (!user) {
      await auditLog({ req, action: "admin.failed_login", metadata: { identifier: normalizedIdentifier } });
      return sendError(res, 401, "unauthorized", "Invalid admin credentials.");
    }

    if (user.status === "disabled" || user.lockedUntil && user.lockedUntil > new Date()) {
      await auditLog({ req, userId: user.id, action: "admin.failed_login", metadata: { reason: "account_locked_or_disabled" } });
      return sendError(res, 401, "unauthorized", "Invalid admin credentials.");
    }

    if (!(await verifyPassword(req.body.password, user.passwordHash))) {
      await recordAdminLoginFailure(user.id, user.failedLoginCount);
      await auditLog({ req, userId: user.id, action: "admin.failed_login", metadata: { identifier: normalizedIdentifier } });
      return sendError(res, 401, "unauthorized", "Invalid admin credentials.");
    }

    const adminRole = await getActiveAdminRole(user.id);
    if (!adminRole) {
      await auditLog({ req, userId: user.id, action: "admin.failed_login", metadata: { reason: "missing_admin_role" } });
      return sendError(res, 403, "forbidden", "Admin role is required.");
    }

    await clearAdminLoginFailures(user.id);
    const { token, session } = await createAdminSession({
      adminUserId: user.id,
      role: adminRole.role,
      ipAddress: req.ip,
      userAgent: req.get("user-agent")
    });
    res.cookie("nexa_admin_session", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      expires: session.expiresAt,
      path: "/admin"
    });
    await auditLog({ req, userId: user.id, action: "admin.logged_in", resourceType: "admin_session", resourceId: session.id });

    return sendSuccess(res, {
      token,
      admin: {
        userId: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: adminRole.role,
        permissions: permissionsForRole(adminRole.role, adminRole.permissions),
        expiresAt: session.expiresAt
      }
    });
  })
);

adminAuthRouter.post(
  "/auth/logout",
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const token = req.get("authorization")?.startsWith("Bearer ")
      ? req.get("authorization")!.slice("Bearer ".length)
      : req.cookies?.nexa_admin_session;
    if (typeof token === "string") {
      await revokeAdminSession(token);
    }
    res.clearCookie("nexa_admin_session", { path: "/admin" });
    await auditLog({ req, userId: req.admin!.userId, action: "admin.logged_out", resourceType: "admin_session", resourceId: req.admin!.sessionId });
    return sendSuccess(res, { loggedOut: true });
  })
);

adminAuthRouter.get(
  "/auth/me",
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.admin!.userId },
      select: { id: true, email: true, username: true, displayName: true }
    });
    return sendSuccess(res, { admin: { ...user, role: req.admin!.role, permissions: req.admin!.permissions } });
  })
);
