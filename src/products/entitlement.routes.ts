import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../utils/api-response.js";
import { checkUserFeatureAccess, getUserEntitlements } from "./entitlement.service.js";
import { z } from "zod";

export const entitlementRouter = Router();
entitlementRouter.use(authenticate);

entitlementRouter.get(
  "/entitlements",
  asyncHandler(async (req, res) => {
    return sendSuccess(res, { entitlements: await getUserEntitlements(req.principal!.userId) });
  })
);

entitlementRouter.post(
  "/entitlements/check-feature",
  validateBody(
    z.object({
      productId: z.string().min(1).optional(),
      feature: z.string().min(1)
    })
  ),
  asyncHandler(async (req, res) => {
    return sendSuccess(
      res,
      await checkUserFeatureAccess({
        userId: req.principal!.userId,
        productId: req.body.productId,
        feature: req.body.feature
      })
    );
  })
);
