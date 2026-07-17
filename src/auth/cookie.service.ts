import type { Response } from "express";
import { isProduction } from "../config/env.js";

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/"
};

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string; accessTokenExpiresAt: Date; refreshTokenExpiresAt: Date }
) {
  res.cookie("nexa_access_token", tokens.accessToken, {
    ...cookieOptions,
    expires: tokens.accessTokenExpiresAt
  });
  res.cookie("nexa_refresh_token", tokens.refreshToken, {
    ...cookieOptions,
    expires: tokens.refreshTokenExpiresAt
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie("nexa_access_token", cookieOptions);
  res.clearCookie("nexa_refresh_token", cookieOptions);
}
