import { Router } from "express";
import { z } from "zod";
import { auditLog } from "../audit/audit.service.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateBody, validateParams } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendError, sendSuccess } from "../utils/api-response.js";
import { BillingProviderUnavailableError } from "./billing-provider.js";
import {
  cancelSubscription,
  createCheckoutSession,
  getBillingReadiness,
  listPlans,
  listUserSubscriptions
} from "./subscription.service.js";

export const subscriptionRouter = Router();

subscriptionRouter.get("/plans", (_req, res) => {
  return sendSuccess(res, { plans: listPlans() });
});

subscriptionRouter.get("/billing/readiness", (_req, res) => {
  return sendSuccess(res, getBillingReadiness());
});

subscriptionRouter.use(authenticate);

subscriptionRouter.get(
  "/subscriptions",
  asyncHandler(async (req, res) => {
    const subscriptions = await listUserSubscriptions(req.principal!.userId);
    return sendSuccess(res, { subscriptions, billing: getBillingReadiness() });
  })
);

subscriptionRouter.post(
  "/subscriptions/checkout",
  validateBody(
    z.object({
      planId: z.enum(["free", "plus", "pro", "premium", "business"]),
      successUrl: z.string().url(),
      cancelUrl: z.string().url()
    })
  ),
  asyncHandler(async (req, res) => {
    try {
      const checkout = await createCheckoutSession({
        userId: req.principal!.userId,
        planId: req.body.planId,
        successUrl: req.body.successUrl,
        cancelUrl: req.body.cancelUrl
      });
      await auditLog({
        req,
        userId: req.principal!.userId,
        action: "billing.checkout_created",
        metadata: { planId: req.body.planId }
      });
      return sendSuccess(res, checkout, 201);
    } catch (error) {
      if (error instanceof BillingProviderUnavailableError) {
        return sendError(res, 400, "bad_request", error.message);
      }

      throw error;
    }
  })
);

subscriptionRouter.post(
  "/subscriptions/:subscriptionId/cancel",
  validateParams(z.object({ subscriptionId: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const subscription = await cancelSubscription({
      userId: req.principal!.userId,
      subscriptionId: String(req.params.subscriptionId)
    });
    await auditLog({
      req,
      userId: req.principal!.userId,
      action: "subscription.cancel_requested",
      resourceType: "subscription",
      resourceId: subscription.id
    });
    return sendSuccess(res, { subscription });
  })
);
