import { Router } from "express";
import { auditLog } from "../audit/audit.service.js";
import { prisma } from "../config/database.js";
import { authenticate } from "../middleware/authenticate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../utils/api-response.js";
import { getUserEntitlements } from "../products/entitlement.service.js";
import { getUserPermissions, upsertPermission } from "../permissions/permission.service.js";
import { presentUser } from "../users/user.presenter.js";
import { validateBody } from "../middleware/validate.js";
import { z } from "zod";
import { createAccountDeletionRequest } from "./account-deletion.service.js";

export const privacyRouter = Router();
privacyRouter.use(authenticate);

privacyRouter.get(
  "/privacy/export",
  asyncHandler(async (req, res) => {
    const userId = req.principal!.userId;
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { profile: true }
    });
    const [permissions, entitlements, devices, sessions, apiKeys, organizations] = await Promise.all([
      getUserPermissions(userId),
      getUserEntitlements(userId),
      prisma.device.findMany({ where: { userId } }),
      prisma.session.findMany({
        where: { userId },
        select: { id: true, deviceId: true, ipAddress: true, userAgent: true, expiresAt: true, revokedAt: true, createdAt: true }
      }),
      prisma.apiKey.findMany({
        where: { userId },
        select: { id: true, organizationId: true, name: true, prefix: true, scopes: true, lastUsedAt: true, expiresAt: true, revokedAt: true, createdAt: true }
      }),
      prisma.organization.findMany({
        where: { members: { some: { userId } } },
        select: { id: true, name: true, slug: true, plan: true, status: true, createdAt: true }
      })
    ]);

    await auditLog({ req, userId, action: "privacy.exported" });
    return sendSuccess(res, {
      user: presentUser(user),
      permissions,
      entitlements,
      devices,
      sessions,
      apiKeys,
      organizations
    });
  })
);

privacyRouter.post(
  "/privacy/disable-ai-data-use",
  asyncHandler(async (req, res) => {
    const userId = req.principal!.userId;
    const [memory, training] = await Promise.all([
      upsertPermission(userId, "ai.memory_enabled", false, "privacy"),
      upsertPermission(userId, "ai.training_opt_in", false, "privacy")
    ]);
    await auditLog({ req, userId, action: "privacy.ai_data_use_disabled" });
    return sendSuccess(res, { permissions: [memory, training] });
  })
);

privacyRouter.post(
  "/privacy/delete-account-request",
  validateBody(z.object({ reason: z.string().max(500).optional() })),
  asyncHandler(async (req, res) => {
    const request = await createAccountDeletionRequest({
      userId: req.principal!.userId,
      reason: req.body.reason
    });
    await auditLog({
      req,
      userId: req.principal!.userId,
      action: "account_deletion.requested",
      resourceType: "account_deletion_request",
      resourceId: request.id
    });
    return sendSuccess(res, { request, manualReviewRequired: true }, 201);
  })
);
