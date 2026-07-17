import type { Response } from "express";

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "internal_error";

export function sendSuccess<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ ok: true, data });
}

export function sendError(res: Response, status: number, code: ApiErrorCode, message: string) {
  return res.status(status).json({ ok: false, error: { code, message } });
}
