import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendSuccess } from "../utils/api-response.js";
import {
  deriveBrowserCapabilities,
  deriveNexaAiCapabilities,
  getIdentityContext
} from "./integration-context.service.js";

export const integrationRouter = Router();
integrationRouter.use(authenticate);

integrationRouter.get(
  "/integrations/browser/bootstrap",
  asyncHandler(async (req, res) => {
    const startedAt = Date.now();
    const context = await getIdentityContext(req.principal!.userId);
    console.info(
      `[integrations/browser/bootstrap] user=${req.principal!.userId} context_ms=${
        Date.now() - startedAt
      }`
    );
    return sendSuccess(res, {
      ...context,
      browser: deriveBrowserCapabilities(context)
    });
  })
);

integrationRouter.get(
  "/integrations/nexa-ai/context",
  asyncHandler(async (req, res) => {
    const context = await getIdentityContext(req.principal!.userId);
    return sendSuccess(res, {
      ...context,
      nexaAi: deriveNexaAiCapabilities(context)
    });
  })
);
