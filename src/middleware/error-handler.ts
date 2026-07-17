import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { sendError } from "../utils/api-response.js";

export function notFound(_req: Request, res: Response) {
  return sendError(res, 404, "not_found", "Route not found.");
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    return sendError(res, 400, "bad_request", error.issues[0]?.message ?? "Invalid request.");
  }

  if (
    error &&
    typeof error === "object" &&
    "type" in error &&
    error.type === "entity.parse.failed"
  ) {
    return sendError(res, 400, "bad_request", "Invalid JSON request body.");
  }

  console.error(error);
  return sendError(res, 500, "internal_error", "Unexpected server error.");
}
