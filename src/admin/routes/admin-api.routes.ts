import { Router } from "express";
import { z } from "zod";
import { auditLog } from "../../audit/audit.service.js";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import { secureRandomToken } from "../../security/hash.js";
import { sendAdminAccountEmail } from "../services/admin-email.service.js";
import {
  disableAdminEntitlement,
  listAdminEntitlements,
  updateAdminEntitlement,
  upsertAdminEntitlement
} from "../services/admin-entitlement.service.js";
import { initializeDefaultPermissions } from "../../permissions/permission.service.js";
import { isKnownPermissionScope } from "../../permissions/scopes.js";
import { sendError, sendSuccess } from "../../utils/api-response.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { authenticateAdmin, requireAdminPermission } from "../middleware/admin-authenticate.js";
import { getAdminSystemHealth } from "../services/admin-health.service.js";
import { getAdminOverview } from "../services/admin-overview.service.js";
import { activeOwnerCount, listAdminRoles, replaceActiveAdminRole } from "../services/admin-role.service.js";
import { getAdminUserDetail, listAdminUsers } from "../services/admin-user.service.js";
import { isAdminPermission, permissionsForRole } from "../services/admin-permission.service.js";

export const adminApiRouter = Router();

const idParams = z.object({ id: z.string().min(1) });
const sessionParams = z.object({ id: z.string().min(1), sessionId: z.string().min(1) });
const entitlementParams = z.object({ id: z.string().min(1), entitlementId: z.string().min(1) });
const apiKeyParams = z.object({ apiKeyId: z.string().min(1) });
const adminRoleParams = z.object({ roleId: z.string().min(1) });
const adminRoleNames = ["owner", "admin", "support", "security", "billing", "developer"] as const;
const productIds = ["nexa_ai", "nexa_browser", "nexa_cloud", "nexa_storage", "nexa_database", "nexa_ide", "nexa_gpu"] as const;
const planIds = ["free", "plus", "pro", "premium", "business", "beta", "internal", "disabled"] as const;
const entitlementBody = z.object({
  productId: z.enum(productIds),
  plan: z.enum(planIds),
  status: z.enum(["active", "expired", "disabled"]).default("active"),
  startsAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
  limits: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  reason: z.string().trim().min(3).max(500)
});
const entitlementUpdateBody = entitlementBody.partial().extend({
  reason: z.string().trim().min(3).max(500)
});
const adminRoleBody = z.object({
  userId: z.string().min(1),
  role: z.enum(adminRoleNames),
  permissions: z.array(z.string().refine(isAdminPermission, "Unknown admin permission.")).optional(),
  reason: z.string().trim().min(3).max(500)
});

adminApiRouter.use(authenticateAdmin);

adminApiRouter.get(
  "/overview",
  requireAdminPermission("admin.system.view"),
  asyncHandler(async (_req, res) => {
    return sendSuccess(res, await getAdminOverview());
  })
);

adminApiRouter.get(
  "/admins",
  requireAdminPermission("admin.admins.manage"),
  asyncHandler(async (_req, res) => {
    return sendSuccess(res, { admins: await listAdminRoles() });
  })
);

adminApiRouter.post(
  "/admins",
  requireAdminPermission("admin.admins.manage"),
  asyncHandler(async (req, res) => {
    const body = adminRoleBody.parse(req.body);
    const user = await prisma.user.findUnique({
      where: { id: body.userId },
      select: { id: true }
    });
    if (!user) {
      return sendError(res, 404, "not_found", "User was not found.");
    }

    const adminRole = await replaceActiveAdminRole({
      userId: body.userId,
      role: body.role,
      createdBy: req.admin!.userId,
      permissions: body.permissions ?? permissionsForRole(body.role)
    });
    await auditLog({
      req,
      userId: req.admin!.userId,
      action: "admin.assigned_admin_role",
      resourceType: "admin_role",
      resourceId: adminRole.id,
      metadata: { targetUserId: body.userId, role: body.role, reason: body.reason }
    });
    return sendSuccess(res, { adminRole }, 201);
  })
);

adminApiRouter.patch(
  "/admins/:roleId",
  requireAdminPermission("admin.admins.manage"),
  asyncHandler(async (req, res) => {
    const params = adminRoleParams.parse(req.params);
    const body = adminRoleBody.omit({ userId: true }).parse(req.body);
    const existing = await prisma.adminRole.findFirst({
      where: { id: params.roleId, revokedAt: null },
      select: { id: true, userId: true, role: true }
    });
    if (!existing) {
      return sendError(res, 404, "not_found", "Admin role was not found.");
    }
    if (existing.role === "owner" && body.role !== "owner" && (await activeOwnerCount(existing.id)) === 0) {
      return sendError(res, 409, "conflict", "Cannot remove the last active owner admin.");
    }

    const adminRole = await prisma.adminRole.update({
      where: { id: existing.id },
      data: {
        role: body.role,
        permissions: body.permissions ?? permissionsForRole(body.role)
      },
      include: {
        user: { select: { id: true, email: true, username: true, displayName: true, status: true } },
        creator: { select: { id: true, email: true, displayName: true } }
      }
    });
    await auditLog({
      req,
      userId: req.admin!.userId,
      action: "admin.updated_admin_role",
      resourceType: "admin_role",
      resourceId: adminRole.id,
      metadata: { targetUserId: existing.userId, role: body.role, reason: body.reason }
    });
    return sendSuccess(res, { adminRole });
  })
);

adminApiRouter.post(
  "/admins/:roleId/revoke",
  requireAdminPermission("admin.admins.manage"),
  asyncHandler(async (req, res) => {
    const params = adminRoleParams.parse(req.params);
    const body = z.object({ reason: z.string().trim().min(3).max(500) }).parse(req.body);
    const existing = await prisma.adminRole.findFirst({
      where: { id: params.roleId, revokedAt: null },
      select: { id: true, userId: true, role: true }
    });
    if (!existing) {
      return sendError(res, 404, "not_found", "Admin role was not found.");
    }
    if (existing.role === "owner" && (await activeOwnerCount(existing.id)) === 0) {
      return sendError(res, 409, "conflict", "Cannot revoke the last active owner admin.");
    }

    await prisma.$transaction([
      prisma.adminRole.update({ where: { id: existing.id }, data: { revokedAt: new Date() } }),
      prisma.adminSession.updateMany({ where: { adminUserId: existing.userId, revokedAt: null }, data: { revokedAt: new Date() } })
    ]);
    await auditLog({
      req,
      userId: req.admin!.userId,
      action: "admin.revoked_admin_role",
      resourceType: "admin_role",
      resourceId: existing.id,
      metadata: { targetUserId: existing.userId, role: existing.role, reason: body.reason }
    });
    return sendSuccess(res, { revoked: true });
  })
);

adminApiRouter.get(
  "/users",
  requireAdminPermission("admin.users.view"),
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        q: z.string().trim().min(1).optional(),
        status: z.enum(["active", "disabled", "locked", "pending_verification"]).optional(),
        take: z.coerce.number().int().positive().max(100).optional(),
        skip: z.coerce.number().int().min(0).optional()
      })
      .parse(req.query);

    return sendSuccess(res, await listAdminUsers(query));
  })
);

adminApiRouter.get(
  "/users/:id",
  requireAdminPermission("admin.users.view"),
  asyncHandler(async (req, res) => {
    const params = idParams.parse(req.params);
    const user = await getAdminUserDetail(params.id);
    if (!user) {
      return sendError(res, 404, "not_found", "User was not found.");
    }

    await auditLog({
      req,
      userId: req.admin!.userId,
      action: "admin.viewed_user",
      resourceType: "user",
      resourceId: params.id
    });

    return sendSuccess(res, { user });
  })
);

adminApiRouter.get(
  "/users/:id/sessions",
  requireAdminPermission("admin.sessions.view"),
  asyncHandler(async (req, res) => {
    const params = idParams.parse(req.params);
    const sessions = await prisma.session.findMany({
      where: { userId: params.id },
      select: {
        id: true,
        deviceId: true,
        ipAddress: true,
        userAgent: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        device: { select: { id: true, deviceName: true, deviceType: true, platform: true, browser: true, trusted: true } }
      },
      orderBy: { createdAt: "desc" }
    });

    return sendSuccess(res, { sessions });
  })
);

adminApiRouter.post(
  "/users/:id/sessions/:sessionId/revoke",
  requireAdminPermission("admin.sessions.revoke"),
  asyncHandler(async (req, res) => {
    const params = sessionParams.parse(req.params);
    const result = await prisma.session.updateMany({
      where: { id: params.sessionId, userId: params.id, revokedAt: null },
      data: { revokedAt: new Date() }
    });

    await auditLog({
      req,
      userId: req.admin!.userId,
      action: "admin.revoked_session",
      resourceType: "session",
      resourceId: params.sessionId,
      metadata: { targetUserId: params.id }
    });

    return sendSuccess(res, { revoked: result.count });
  })
);

adminApiRouter.post(
  "/users/:id/sessions/revoke-all",
  requireAdminPermission("admin.sessions.revoke"),
  asyncHandler(async (req, res) => {
    const params = idParams.parse(req.params);
    const result = await prisma.session.updateMany({
      where: { userId: params.id, revokedAt: null },
      data: { revokedAt: new Date() }
    });

    await auditLog({
      req,
      userId: req.admin!.userId,
      action: "admin.revoked_all_sessions",
      resourceType: "user",
      resourceId: params.id
    });

    return sendSuccess(res, { revoked: result.count });
  })
);

adminApiRouter.get(
  "/users/:id/devices",
  requireAdminPermission("admin.devices.view"),
  asyncHandler(async (req, res) => {
    const params = idParams.parse(req.params);
    const devices = await prisma.device.findMany({
      where: { userId: params.id },
      select: {
        id: true,
        deviceName: true,
        deviceType: true,
        platform: true,
        browser: true,
        lastIpAddress: true,
        lastActiveAt: true,
        trusted: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [{ lastActiveAt: "desc" }, { createdAt: "desc" }]
    });

    return sendSuccess(res, { devices });
  })
);

adminApiRouter.patch(
  "/users/:id",
  requireAdminPermission("admin.users.update"),
  asyncHandler(async (req, res) => {
    const params = idParams.parse(req.params);
    const body = z
      .object({
        displayName: z.string().trim().min(1).max(120).optional(),
        username: z.string().trim().min(3).max(40).optional(),
        emailVerified: z.boolean().optional(),
        reason: z.string().trim().min(3).max(500)
      })
      .parse(req.body);
    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        displayName: body.displayName,
        username: body.username,
        emailVerified: body.emailVerified
      },
      select: { id: true, email: true, username: true, displayName: true, emailVerified: true, status: true, updatedAt: true }
    });

    await auditLog({
      req,
      userId: req.admin!.userId,
      action: "admin.updated_user",
      resourceType: "user",
      resourceId: user.id,
      metadata: { reason: body.reason, fields: Object.keys(body).filter((key) => key !== "reason") }
    });

    return sendSuccess(res, { user });
  })
);

adminApiRouter.post(
  "/users/:id/disable",
  requireAdminPermission("admin.users.disable"),
  asyncHandler(async (req, res) => {
    const params = idParams.parse(req.params);
    const body = z.object({ reason: z.string().trim().min(3).max(500) }).parse(req.body);
    await prisma.$transaction([
      prisma.user.update({ where: { id: params.id }, data: { status: "disabled" } }),
      prisma.session.updateMany({ where: { userId: params.id, revokedAt: null }, data: { revokedAt: new Date() } })
    ]);
    await auditLog({
      req,
      userId: req.admin!.userId,
      action: "admin.disabled_user",
      resourceType: "user",
      resourceId: params.id,
      metadata: { reason: body.reason }
    });
    return sendSuccess(res, { disabled: true });
  })
);

adminApiRouter.post(
  "/users/:id/enable",
  requireAdminPermission("admin.users.disable"),
  asyncHandler(async (req, res) => {
    const params = idParams.parse(req.params);
    const body = z.object({ reason: z.string().trim().min(3).max(500) }).parse(req.body);
    await prisma.user.update({ where: { id: params.id }, data: { status: "active", lockedUntil: null, failedLoginCount: 0 } });
    await auditLog({
      req,
      userId: req.admin!.userId,
      action: "admin.enabled_user",
      resourceType: "user",
      resourceId: params.id,
      metadata: { reason: body.reason }
    });
    return sendSuccess(res, { enabled: true });
  })
);

adminApiRouter.get(
  "/users/:id/entitlements",
  requireAdminPermission("admin.entitlements.view"),
  asyncHandler(async (req, res) => {
    const params = idParams.parse(req.params);
    return sendSuccess(res, { entitlements: await listAdminEntitlements(params.id) });
  })
);

adminApiRouter.post(
  "/users/:id/entitlements",
  requireAdminPermission("admin.entitlements.update"),
  asyncHandler(async (req, res) => {
    const params = idParams.parse(req.params);
    const body = entitlementBody.parse(req.body);
    const entitlement = await upsertAdminEntitlement({
      userId: params.id,
      productId: body.productId,
      plan: body.plan,
      status: body.status,
      startsAt: body.startsAt,
      expiresAt: body.expiresAt,
      limits: body.limits,
      metadata: body.metadata
    });
    await auditLog({
      req,
      userId: req.admin!.userId,
      action: "admin.updated_entitlement",
      resourceType: "product_entitlement",
      resourceId: entitlement.id,
      metadata: { targetUserId: params.id, productId: body.productId, plan: body.plan, status: body.status, reason: body.reason }
    });
    return sendSuccess(res, { entitlement }, 201);
  })
);

adminApiRouter.patch(
  "/users/:id/entitlements/:entitlementId",
  requireAdminPermission("admin.entitlements.update"),
  asyncHandler(async (req, res) => {
    const params = entitlementParams.parse(req.params);
    const body = entitlementUpdateBody.parse(req.body);
    const entitlement = await updateAdminEntitlement({
      userId: params.id,
      entitlementId: params.entitlementId,
      plan: body.plan,
      status: body.status,
      startsAt: body.startsAt,
      expiresAt: body.expiresAt,
      limits: body.limits,
      metadata: body.metadata
    });
    if (!entitlement) {
      return sendError(res, 404, "not_found", "Entitlement was not found.");
    }
    await auditLog({
      req,
      userId: req.admin!.userId,
      action: "admin.updated_entitlement",
      resourceType: "product_entitlement",
      resourceId: entitlement.id,
      metadata: { targetUserId: params.id, reason: body.reason }
    });
    return sendSuccess(res, { entitlement });
  })
);

adminApiRouter.post(
  "/users/:id/entitlements/:entitlementId/disable",
  requireAdminPermission("admin.entitlements.update"),
  asyncHandler(async (req, res) => {
    const params = entitlementParams.parse(req.params);
    const body = z.object({ reason: z.string().trim().min(3).max(500) }).parse(req.body);
    const result = await disableAdminEntitlement(params.id, params.entitlementId);
    await auditLog({
      req,
      userId: req.admin!.userId,
      action: "admin.disabled_entitlement",
      resourceType: "product_entitlement",
      resourceId: params.entitlementId,
      metadata: { targetUserId: params.id, reason: body.reason }
    });
    return sendSuccess(res, { disabled: result.count });
  })
);

adminApiRouter.get(
  "/users/:id/permissions",
  requireAdminPermission("admin.permissions.view"),
  asyncHandler(async (req, res) => {
    const params = idParams.parse(req.params);
    const permissions = await prisma.permission.findMany({ where: { userId: params.id }, orderBy: { scope: "asc" } });
    return sendSuccess(res, { permissions });
  })
);

adminApiRouter.patch(
  "/users/:id/permissions/:scope",
  requireAdminPermission("admin.permissions.reset"),
  asyncHandler(async (req, res) => {
    const params = z.object({ id: z.string().min(1), scope: z.string().min(1) }).parse(req.params);
    const body = z.object({ value: z.boolean(), reason: z.string().trim().min(3).max(500) }).parse(req.body);
    if (!isKnownPermissionScope(params.scope)) {
      return sendError(res, 400, "bad_request", "Permission scope is not recognized.");
    }
    const permission = await prisma.permission.upsert({
      where: { userId_scope: { userId: params.id, scope: params.scope } },
      create: { userId: params.id, scope: params.scope, value: body.value, source: "admin" },
      update: { value: body.value, source: "admin" }
    });
    await auditLog({
      req,
      userId: req.admin!.userId,
      action: "admin.updated_permission",
      resourceType: "permission",
      resourceId: permission.id,
      metadata: { targetUserId: params.id, scope: params.scope, value: body.value, reason: body.reason }
    });
    return sendSuccess(res, { permission });
  })
);

adminApiRouter.post(
  "/users/:id/permissions/reset",
  requireAdminPermission("admin.permissions.reset"),
  asyncHandler(async (req, res) => {
    const params = idParams.parse(req.params);
    const body = z.object({ reason: z.string().trim().min(3).max(500) }).parse(req.body);
    await prisma.permission.deleteMany({ where: { userId: params.id } });
    await initializeDefaultPermissions(params.id);
    const permissions = await prisma.permission.findMany({ where: { userId: params.id }, orderBy: { scope: "asc" } });
    await auditLog({
      req,
      userId: req.admin!.userId,
      action: "admin.reset_permission",
      resourceType: "user",
      resourceId: params.id,
      metadata: { reason: body.reason }
    });
    return sendSuccess(res, { permissions });
  })
);

adminApiRouter.get(
  "/beta/users",
  requireAdminPermission("admin.beta.view"),
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        product: z.enum(productIds).optional(),
        status: z.enum(["invited", "active", "paused", "removed", "completed"]).optional(),
        take: z.coerce.number().int().positive().max(100).optional(),
        skip: z.coerce.number().int().min(0).optional()
      })
      .parse(req.query);
    const take = query.take ?? 50;
    const skip = query.skip ?? 0;
    const where = {
      ...(query.status ? { betaStatus: query.status } : {}),
      ...(query.product ? { products: { has: query.product } } : {})
    };
    const [betaUsers, total] = await Promise.all([
      prisma.betaAccess.findMany({
        where,
        include: { user: { select: { id: true, email: true, username: true, displayName: true, status: true } } },
        orderBy: { updatedAt: "desc" },
        take,
        skip
      }),
      prisma.betaAccess.count({ where })
    ]);
    return sendSuccess(res, { betaUsers, pagination: { take, skip, total } });
  })
);

adminApiRouter.post(
  "/beta/users/:id/add",
  requireAdminPermission("admin.beta.update"),
  asyncHandler(async (req, res) => {
    const params = idParams.parse(req.params);
    const body = z
      .object({
        products: z.array(z.enum(productIds)).min(1),
        betaStatus: z.enum(["invited", "active", "paused", "removed", "completed"]).default("active"),
        testerType: z.enum(["internal", "developer", "student", "founder", "business", "friend_family", "public_beta"]).default("public_beta"),
        notes: z.string().trim().max(2000).optional(),
        feedbackStatus: z.string().trim().max(120).optional(),
        reason: z.string().trim().min(3).max(500)
      })
      .parse(req.body);
    const betaAccess = await prisma.betaAccess.upsert({
      where: { userId: params.id },
      create: {
        userId: params.id,
        products: body.products,
        betaStatus: body.betaStatus,
        testerType: body.testerType,
        inviteCode: secureRandomToken(10),
        invitedAt: new Date(),
        joinedAt: body.betaStatus === "active" ? new Date() : undefined,
        notes: body.notes,
        feedbackStatus: body.feedbackStatus
      },
      update: {
        products: body.products,
        betaStatus: body.betaStatus,
        testerType: body.testerType,
        joinedAt: body.betaStatus === "active" ? new Date() : undefined,
        notes: body.notes,
        feedbackStatus: body.feedbackStatus
      }
    });
    await auditLog({
      req,
      userId: req.admin!.userId,
      action: "admin.updated_beta_status",
      resourceType: "beta_access",
      resourceId: betaAccess.id,
      metadata: { targetUserId: params.id, products: body.products, betaStatus: body.betaStatus, reason: body.reason }
    });
    return sendSuccess(res, { betaAccess });
  })
);

adminApiRouter.post(
  "/beta/users/:id/remove",
  requireAdminPermission("admin.beta.update"),
  asyncHandler(async (req, res) => {
    const params = idParams.parse(req.params);
    const body = z.object({ reason: z.string().trim().min(3).max(500) }).parse(req.body);
    const betaAccess = await prisma.betaAccess.update({
      where: { userId: params.id },
      data: { betaStatus: "removed" }
    });
    await auditLog({
      req,
      userId: req.admin!.userId,
      action: "admin.updated_beta_status",
      resourceType: "beta_access",
      resourceId: betaAccess.id,
      metadata: { targetUserId: params.id, betaStatus: "removed", reason: body.reason }
    });
    return sendSuccess(res, { betaAccess });
  })
);

adminApiRouter.post(
  "/beta/invites",
  requireAdminPermission("admin.beta.update"),
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        userId: z.string().min(1),
        products: z.array(z.enum(productIds)).min(1),
        testerType: z.enum(["internal", "developer", "student", "founder", "business", "friend_family", "public_beta"]).default("public_beta"),
        notes: z.string().trim().max(2000).optional(),
        reason: z.string().trim().min(3).max(500)
      })
      .parse(req.body);
    const betaAccess = await prisma.betaAccess.upsert({
      where: { userId: body.userId },
      create: {
        userId: body.userId,
        products: body.products,
        betaStatus: "invited",
        testerType: body.testerType,
        inviteCode: secureRandomToken(10),
        invitedAt: new Date(),
        notes: body.notes
      },
      update: {
        products: body.products,
        betaStatus: "invited",
        testerType: body.testerType,
        inviteCode: secureRandomToken(10),
        invitedAt: new Date(),
        notes: body.notes
      }
    });
    await auditLog({
      req,
      userId: req.admin!.userId,
      action: "admin.created_beta_invite",
      resourceType: "beta_access",
      resourceId: betaAccess.id,
      metadata: { targetUserId: body.userId, products: body.products, reason: body.reason }
    });
    return sendSuccess(res, { betaAccess }, 201);
  })
);

adminApiRouter.post(
  "/email/:id/send-verification",
  requireAdminPermission("admin.email.resend_verification"),
  asyncHandler(async (req, res) => {
    const params = idParams.parse(req.params);
    const event = await sendAdminAccountEmail({ adminUserId: req.admin!.userId, targetUserId: params.id, template: "verify_email" });
    if (!event) {
      return sendError(res, 404, "not_found", "User was not found.");
    }
    await auditLog({
      req,
      userId: req.admin!.userId,
      action: "admin.sent_verification_email",
      resourceType: "email_event",
      resourceId: event.id,
      metadata: { targetUserId: params.id, status: event.status }
    });
    return sendSuccess(res, { emailEvent: event });
  })
);

adminApiRouter.post(
  "/email/:id/send-password-reset",
  requireAdminPermission("admin.email.send_password_reset"),
  asyncHandler(async (req, res) => {
    const params = idParams.parse(req.params);
    const event = await sendAdminAccountEmail({ adminUserId: req.admin!.userId, targetUserId: params.id, template: "password_reset" });
    if (!event) {
      return sendError(res, 404, "not_found", "User was not found.");
    }
    await auditLog({
      req,
      userId: req.admin!.userId,
      action: "admin.sent_password_reset",
      resourceType: "email_event",
      resourceId: event.id,
      metadata: { targetUserId: params.id, status: event.status }
    });
    return sendSuccess(res, { emailEvent: event });
  })
);

adminApiRouter.post(
  "/email/:id/send-beta-invite",
  requireAdminPermission("admin.beta.update"),
  asyncHandler(async (req, res) => {
    const params = idParams.parse(req.params);
    const event = await sendAdminAccountEmail({ adminUserId: req.admin!.userId, targetUserId: params.id, template: "beta_invite" });
    if (!event) {
      return sendError(res, 404, "not_found", "User was not found.");
    }
    await auditLog({
      req,
      userId: req.admin!.userId,
      action: "admin.sent_beta_invite",
      resourceType: "email_event",
      resourceId: event.id,
      metadata: { targetUserId: params.id, status: event.status }
    });
    return sendSuccess(res, { emailEvent: event });
  })
);

adminApiRouter.get(
  "/audit-logs",
  requireAdminPermission("admin.audit.view"),
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        userId: z.string().min(1).optional(),
        action: z.string().min(1).optional(),
        resourceType: z.string().min(1).optional(),
        take: z.coerce.number().int().positive().max(100).optional(),
        skip: z.coerce.number().int().min(0).optional()
      })
      .parse(req.query);
    const take = query.take ?? 50;
    const skip = query.skip ?? 0;
    const where = {
      ...(query.userId ? { userId: query.userId } : {}),
      ...(query.action ? { action: { contains: query.action, mode: "insensitive" as const } } : {}),
      ...(query.resourceType ? { resourceType: query.resourceType } : {})
    };
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take, skip }),
      prisma.auditLog.count({ where })
    ]);

    await auditLog({ req, userId: req.admin!.userId, action: "admin.viewed_audit_logs", metadata: { filters: query } });

    return sendSuccess(res, { logs, pagination: { take, skip, total } });
  })
);

adminApiRouter.get(
  "/api-keys",
  requireAdminPermission("admin.api_keys.view"),
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        userId: z.string().min(1).optional(),
        take: z.coerce.number().int().positive().max(100).optional(),
        skip: z.coerce.number().int().min(0).optional()
      })
      .parse(req.query);
    const take = query.take ?? 50;
    const skip = query.skip ?? 0;
    const where = query.userId ? { userId: query.userId } : {};
    const [apiKeys, total] = await Promise.all([
      prisma.apiKey.findMany({
        where,
        select: {
          id: true,
          userId: true,
          organizationId: true,
          name: true,
          prefix: true,
          scopes: true,
          lastUsedAt: true,
          expiresAt: true,
          revokedAt: true,
          createdAt: true,
          user: { select: { id: true, email: true, displayName: true } }
        },
        orderBy: { createdAt: "desc" },
        take,
        skip
      }),
      prisma.apiKey.count({ where })
    ]);

    return sendSuccess(res, { apiKeys, pagination: { take, skip, total } });
  })
);

adminApiRouter.get(
  "/users/:id/api-keys",
  requireAdminPermission("admin.api_keys.view"),
  asyncHandler(async (req, res) => {
    const params = idParams.parse(req.params);
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: params.id },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        name: true,
        prefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    });
    return sendSuccess(res, { apiKeys });
  })
);

adminApiRouter.post(
  "/api-keys/:apiKeyId/revoke",
  requireAdminPermission("admin.api_keys.revoke"),
  asyncHandler(async (req, res) => {
    const params = apiKeyParams.parse(req.params);
    const body = z.object({ reason: z.string().trim().min(3).max(500) }).parse(req.body);
    const result = await prisma.apiKey.updateMany({
      where: { id: params.apiKeyId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    await auditLog({
      req,
      userId: req.admin!.userId,
      action: "admin.revoked_api_key",
      resourceType: "api_key",
      resourceId: params.apiKeyId,
      metadata: { reason: body.reason }
    });
    return sendSuccess(res, { revoked: result.count });
  })
);

adminApiRouter.get(
  "/organizations",
  requireAdminPermission("admin.users.view"),
  asyncHandler(async (_req, res) => {
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, email: true, displayName: true } },
        _count: { select: { members: true, apiKeys: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    });

    return sendSuccess(res, { organizations });
  })
);

adminApiRouter.get(
  "/organizations/:id",
  requireAdminPermission("admin.users.view"),
  asyncHandler(async (req, res) => {
    const params = idParams.parse(req.params);
    const organization = await prisma.organization.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, email: true, displayName: true } },
        members: {
          select: {
            id: true,
            role: true,
            status: true,
            createdAt: true,
            user: { select: { id: true, email: true, displayName: true } }
          },
          orderBy: { createdAt: "asc" }
        },
        apiKeys: {
          select: {
            id: true,
            name: true,
            prefix: true,
            scopes: true,
            lastUsedAt: true,
            expiresAt: true,
            revokedAt: true,
            createdAt: true
          },
          orderBy: { createdAt: "desc" }
        }
      }
    });
    if (!organization) {
      return sendError(res, 404, "not_found", "Organization was not found.");
    }
    return sendSuccess(res, { organization });
  })
);

adminApiRouter.get(
  "/system/health",
  requireAdminPermission("admin.system.view"),
  asyncHandler(async (_req, res) => {
    return sendSuccess(res, await getAdminSystemHealth());
  })
);

adminApiRouter.get(
  "/settings",
  requireAdminPermission("admin.system.view"),
  asyncHandler(async (req, res) => {
    return sendSuccess(res, {
      admin: {
        userId: req.admin!.userId,
        role: req.admin!.role,
        sessionId: req.admin!.sessionId,
        permissions: req.admin!.permissions
      },
      environment: env.APP_ENV,
      sessionExpiresIn: env.ADMIN_SESSION_EXPIRES_IN,
      dashboardEnabled: env.ADMIN_DASHBOARD_ENABLED,
      allowLan: env.ADMIN_ALLOW_LAN,
      allowedIpsConfigured: env.ADMIN_ALLOWED_IPS.length > 0,
      httpsRequired: env.ADMIN_REQUIRE_HTTPS,
      ownerBootstrapEnabled: env.ALLOW_OWNER_BOOTSTRAP
    });
  })
);
