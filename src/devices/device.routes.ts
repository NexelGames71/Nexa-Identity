import { Router } from "express";
import { z } from "zod";
import { auditLog } from "../audit/audit.service.js";
import { prisma } from "../config/database.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../utils/api-response.js";

export const deviceRouter = Router();
deviceRouter.use(authenticate);

deviceRouter.get(
  "/devices",
  asyncHandler(async (req, res) => {
    const devices = await prisma.device.findMany({
      where: { userId: req.principal!.userId },
      orderBy: { lastActiveAt: "desc" }
    });
    return sendSuccess(res, { devices });
  })
);

deviceRouter.patch(
  "/devices/:deviceId",
  validateParams(z.object({ deviceId: z.string().min(1) })),
  validateBody(
    z.object({
      deviceName: z.string().min(1).max(80).optional(),
      trusted: z.boolean().optional()
    })
  ),
  asyncHandler(async (req, res) => {
    const deviceId = String(req.params.deviceId);
    await prisma.device.updateMany({
      where: { id: deviceId, userId: req.principal!.userId },
      data: req.body
    });
    const device = await prisma.device.findFirstOrThrow({
      where: { id: deviceId, userId: req.principal!.userId }
    });
    await auditLog({ req, userId: req.principal!.userId, action: "device.updated", resourceType: "device", resourceId: device.id });
    return sendSuccess(res, { device });
  })
);
