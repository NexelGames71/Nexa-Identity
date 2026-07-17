import { Router } from "express";
import { z } from "zod";
import { auditLog } from "../audit/audit.service.js";
import { prisma } from "../config/database.js";
import { authenticate, requireAdmin } from "../middleware/authenticate.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../utils/api-response.js";
import { getPlan } from "../products/plan.service.js";
import { manuallyAssignSubscription } from "../subscriptions/subscription.service.js";
import { reviewAccountDeletionRequest } from "../privacy/account-deletion.service.js";

export const adminRouter = Router();
adminRouter.use(authenticate, requireAdmin);

adminRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const users = await prisma.user.findMany({
      where: query
        ? {
            OR: [
              { email: { contains: query, mode: "insensitive" } },
              { username: { contains: query, mode: "insensitive" } },
              { displayName: { contains: query, mode: "insensitive" } }
            ]
          }
        : undefined,
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        emailVerified: true,
        status: true,
        role: true,
        createdAt: true
      },
      take: 50,
      orderBy: { createdAt: "desc" }
    });
    return sendSuccess(res, { users });
  })
);

adminRouter.patch(
  "/users/:userId/status",
  validateParams(z.object({ userId: z.string().min(1) })),
  validateBody(z.object({ status: z.enum(["active", "disabled", "locked", "pending_verification"]) })),
  asyncHandler(async (req, res) => {
    const userId = String(req.params.userId);
    const user = await prisma.user.update({
      where: { id: userId },
      data: { status: req.body.status }
    });
    await auditLog({ req, userId: req.principal!.userId, action: "admin.user_status_updated", resourceType: "user", resourceId: user.id, metadata: { status: user.status } });
    return sendSuccess(res, { user });
  })
);

adminRouter.get(
  "/users/:userId/entitlements",
  validateParams(z.object({ userId: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const userId = String(req.params.userId);
    const entitlements = await prisma.productEntitlement.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { productId: "asc" }
    });
    return sendSuccess(res, { entitlements });
  })
);

adminRouter.put(
  "/users/:userId/entitlements",
  validateParams(z.object({ userId: z.string().min(1) })),
  validateBody(
    z.object({
      productId: z.string().min(1),
      plan: z.enum(["free", "plus", "pro", "premium", "business"]),
      status: z.enum(["active", "expired", "disabled"]).default("active"),
      expiresAt: z.coerce.date().optional()
    })
  ),
  asyncHandler(async (req, res) => {
    const userId = String(req.params.userId);
    const plan = getPlan(req.body.plan);
    const entitlement = await prisma.productEntitlement.upsert({
      where: { userId_productId: { userId, productId: req.body.productId } },
      create: {
        userId,
        productId: req.body.productId,
        plan: req.body.plan,
        status: req.body.status,
        limits: plan.limits,
        expiresAt: req.body.expiresAt
      },
      update: {
        plan: req.body.plan,
        status: req.body.status,
        limits: plan.limits,
        expiresAt: req.body.expiresAt
      }
    });
    await auditLog({ req, userId: req.principal!.userId, action: "entitlement.updated", resourceType: "entitlement", resourceId: entitlement.id, metadata: { targetUserId: userId } });
    return sendSuccess(res, { entitlement });
  })
);

adminRouter.post(
  "/users/:userId/subscriptions/manual",
  validateParams(z.object({ userId: z.string().min(1) })),
  validateBody(z.object({ planId: z.enum(["free", "plus", "pro", "premium", "business"]) })),
  asyncHandler(async (req, res) => {
    const userId = String(req.params.userId);
    const subscription = await manuallyAssignSubscription({ userId, planId: req.body.planId });
    await auditLog({ req, userId: req.principal!.userId, action: "subscription.updated", resourceType: "subscription", resourceId: subscription.id, metadata: { targetUserId: userId, planId: req.body.planId } });
    return sendSuccess(res, { subscription }, 201);
  })
);

adminRouter.get(
  "/sessions",
  asyncHandler(async (_req, res) => {
    const sessions = await prisma.session.findMany({
      take: 100,
      include: { user: { select: { id: true, email: true, username: true } }, device: true },
      orderBy: { createdAt: "desc" }
    });
    return sendSuccess(res, { sessions });
  })
);

adminRouter.get(
  "/audit-logs",
  asyncHandler(async (_req, res) => {
    const auditLogs = await prisma.auditLog.findMany({
      take: 100,
      orderBy: { createdAt: "desc" }
    });
    return sendSuccess(res, { auditLogs });
  })
);

adminRouter.get(
  "/account-deletion-requests",
  asyncHandler(async (_req, res) => {
    const requests = await prisma.accountDeletionRequest.findMany({
      take: 100,
      orderBy: { createdAt: "desc" }
    });
    return sendSuccess(res, { requests });
  })
);

adminRouter.patch(
  "/account-deletion-requests/:requestId",
  validateParams(z.object({ requestId: z.string().min(1) })),
  validateBody(z.object({ status: z.enum(["approved", "rejected"]) })),
  asyncHandler(async (req, res) => {
    const request = await reviewAccountDeletionRequest({
      requestId: String(req.params.requestId),
      reviewedBy: req.principal!.userId,
      status: req.body.status
    });
    await auditLog({
      req,
      userId: req.principal!.userId,
      action: "account_deletion.reviewed",
      resourceType: "account_deletion_request",
      resourceId: request.id,
      metadata: { status: request.status, targetUserId: request.userId }
    });
    return sendSuccess(res, { request });
  })
);

adminRouter.delete(
  "/sessions/:sessionId",
  validateParams(z.object({ sessionId: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const sessionId = String(req.params.sessionId);
    await prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() }
    });
    await auditLog({ req, userId: req.principal!.userId, action: "admin.session_revoked", resourceType: "session", resourceId: sessionId });
    return sendSuccess(res, { revoked: true });
  })
);
