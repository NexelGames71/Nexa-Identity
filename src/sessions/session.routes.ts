import { Router } from "express";
import { z } from "zod";
import { auditLog } from "../audit/audit.service.js";
import { prisma } from "../config/database.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateParams } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../utils/api-response.js";

export const sessionRouter = Router();
sessionRouter.use(authenticate);

sessionRouter.get(
  "/sessions",
  asyncHandler(async (req, res) => {
    const sessions = await prisma.session.findMany({
      where: { userId: req.principal!.userId },
      include: { device: true },
      orderBy: { createdAt: "desc" }
    });
    return sendSuccess(res, { sessions });
  })
);

sessionRouter.delete(
  "/sessions/:sessionId",
  validateParams(z.object({ sessionId: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const sessionId = String(req.params.sessionId);
    await prisma.session.updateMany({
      where: { id: sessionId, userId: req.principal!.userId },
      data: { revokedAt: new Date() }
    });
    await auditLog({ req, userId: req.principal!.userId, action: "session.revoked", resourceType: "session", resourceId: sessionId });
    return sendSuccess(res, { revoked: true });
  })
);

sessionRouter.delete(
  "/sessions",
  asyncHandler(async (req, res) => {
    await prisma.session.updateMany({
      where: { userId: req.principal!.userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    await auditLog({ req, userId: req.principal!.userId, action: "sessions.revoked_all" });
    return sendSuccess(res, { revoked: true });
  })
);
