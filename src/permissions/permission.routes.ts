import { Router } from "express";
import { z } from "zod";
import { auditLog } from "../audit/audit.service.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendError, sendSuccess } from "../utils/api-response.js";
import { getUserPermissions, upsertPermission } from "./permission.service.js";
import { isKnownPermissionScope } from "./scopes.js";

export const permissionRouter = Router();
permissionRouter.use(authenticate);

permissionRouter.get(
  "/permissions",
  asyncHandler(async (req, res) => {
    return sendSuccess(res, { permissions: await getUserPermissions(req.principal!.userId) });
  })
);

permissionRouter.post(
  "/permissions/check",
  validateBody(z.object({ scope: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const permission = (await getUserPermissions(req.principal!.userId)).find((entry) => entry.scope === req.body.scope);
    return sendSuccess(res, { scope: req.body.scope, allowed: Boolean(permission?.value) });
  })
);

permissionRouter.put(
  "/permissions",
  validateBody(z.object({ scope: z.string().min(1), value: z.boolean() })),
  asyncHandler(async (req, res) => {
    if (!isKnownPermissionScope(req.body.scope)) {
      return sendError(res, 400, "bad_request", "Unknown permission scope.");
    }

    const permission = await upsertPermission(req.principal!.userId, req.body.scope, req.body.value);
    await auditLog({ req, userId: req.principal!.userId, action: "permission.updated", resourceType: "permission", resourceId: permission.id, metadata: { scope: permission.scope, value: permission.value } });
    return sendSuccess(res, { permission });
  })
);

permissionRouter.delete(
  "/permissions/:scope",
  asyncHandler(async (req, res) => {
    const scope = String(req.params.scope);
    const permission = await upsertPermission(req.principal!.userId, scope, false);
    await auditLog({ req, userId: req.principal!.userId, action: "permission.revoked", resourceType: "permission", resourceId: permission.id, metadata: { scope: permission.scope } });
    return sendSuccess(res, { permission });
  })
);
