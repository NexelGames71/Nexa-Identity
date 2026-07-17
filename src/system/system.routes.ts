import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { getReadiness } from "./readiness.service.js";

export const systemRouter = Router();

systemRouter.get(
  "/ready",
  asyncHandler(async (_req, res) => {
    const readiness = await getReadiness();
    const statusCode = readiness.status === "not_ready" ? 503 : 200;
    res.status(statusCode).json({ ok: readiness.status !== "not_ready", data: readiness });
  })
);
