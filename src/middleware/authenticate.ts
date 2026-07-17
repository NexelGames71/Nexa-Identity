import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../auth/token.service.js";
import { sendError } from "../utils/api-response.js";

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.get("authorization");
  const token = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : typeof req.cookies?.nexa_access_token === "string"
      ? req.cookies.nexa_access_token
      : undefined;

  if (!token) {
    return sendError(res, 401, "unauthorized", "Authentication is required.");
  }

  try {
    req.principal = await verifyAccessToken(token);
    return next();
  } catch {
    return sendError(res, 401, "unauthorized", "Access token is invalid or expired.");
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.principal?.role !== "admin") {
    return sendError(res, 403, "forbidden", "Admin access is required.");
  }

  return next();
}
