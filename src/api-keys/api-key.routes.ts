import { Router } from "express";
import { z } from "zod";
import { auditLog } from "../audit/audit.service.js";
import { env } from "../config/env.js";
import { prisma } from "../config/database.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../utils/api-response.js";
import { createApiKey, verifyApiKey } from "./api-key.service.js";

const apiKeyScopes = [
  "storage.read",
  "storage.write",
  "database.read",
  "database.write",
  "ai.chat",
  "ai.tts",
  "ai.asr",
  "guardian.scan"
] as const;

export const apiKeyRouter = Router();

apiKeyRouter.post(
  "/api-keys/verify",
  validateBody(
    z.object({
      apiKey: z.string().min(1),
      requiredScopes: z.array(z.string().min(1)).optional()
    })
  ),
  asyncHandler(async (req, res) => {
    const result = await verifyApiKey({
      plainKey: req.body.apiKey,
      requiredScopes: req.body.requiredScopes
    });
    return sendSuccess(res, result);
  })
);

apiKeyRouter.use(authenticate);

apiKeyRouter.post(
  "/api-keys",
  validateBody(
    z.object({
      name: z.string().min(1).max(80),
      organizationId: z.string().optional(),
      scopes: z.array(z.enum(apiKeyScopes)).min(1),
      expiresAt: z.coerce.date().optional()
    })
  ),
  asyncHandler(async (req, res) => {
    const { apiKey, plainKey } = await createApiKey({
      userId: req.principal!.userId,
      organizationId: req.body.organizationId,
      name: req.body.name,
      scopes: req.body.scopes,
      expiresAt: req.body.expiresAt,
      appEnv: env.APP_ENV
    });
    await auditLog({ req, userId: req.principal!.userId, organizationId: req.body.organizationId, action: "api_key.created", resourceType: "api_key", resourceId: apiKey.id });
    const { keyHash: _keyHash, ...publicApiKey } = apiKey;
    return sendSuccess(res, { apiKey: publicApiKey, plainKey }, 201);
  })
);

apiKeyRouter.get(
  "/api-keys",
  asyncHandler(async (req, res) => {
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: req.principal!.userId },
      select: {
        id: true,
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

apiKeyRouter.patch(
  "/api-keys/:apiKeyId",
  validateParams(z.object({ apiKeyId: z.string().min(1) })),
  validateBody(z.object({ scopes: z.array(z.enum(apiKeyScopes)).min(1) })),
  asyncHandler(async (req, res) => {
    const apiKeyId = String(req.params.apiKeyId);
    await prisma.apiKey.updateMany({
      where: { id: apiKeyId, userId: req.principal!.userId },
      data: { scopes: req.body.scopes }
    });
    const apiKey = await prisma.apiKey.findFirstOrThrow({
      where: { id: apiKeyId, userId: req.principal!.userId },
      select: { id: true, name: true, prefix: true, scopes: true, revokedAt: true }
    });
    await auditLog({ req, userId: req.principal!.userId, action: "api_key.updated", resourceType: "api_key", resourceId: apiKey.id });
    return sendSuccess(res, { apiKey });
  })
);

apiKeyRouter.delete(
  "/api-keys/:apiKeyId",
  validateParams(z.object({ apiKeyId: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const apiKeyId = String(req.params.apiKeyId);
    await prisma.apiKey.updateMany({
      where: { id: apiKeyId, userId: req.principal!.userId },
      data: { revokedAt: new Date() }
    });
    const apiKey = await prisma.apiKey.findFirstOrThrow({ where: { id: apiKeyId, userId: req.principal!.userId } });
    await auditLog({ req, userId: req.principal!.userId, action: "api_key.revoked", resourceType: "api_key", resourceId: apiKey.id });
    return sendSuccess(res, { revoked: true });
  })
);
