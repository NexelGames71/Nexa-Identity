import { jwtVerify, SignJWT } from "jose";
import { env } from "../config/env.js";
import { addDuration } from "../utils/time.js";
import type { AuthenticatedPrincipal } from "./types.js";

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

export async function signAccessToken(principal: AuthenticatedPrincipal) {
  const expiresAt = addDuration(new Date(), env.ACCESS_TOKEN_EXPIRES_IN);
  const token = await new SignJWT({ ...principal })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(principal.userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(accessSecret);

  return { token, expiresAt };
}

export async function signRefreshToken(sessionId: string, userId: string) {
  const expiresAt = addDuration(new Date(), env.REFRESH_TOKEN_EXPIRES_IN);
  const token = await new SignJWT({ sessionId, userId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(refreshSecret);

  return { token, expiresAt };
}

export async function verifyAccessToken(token: string): Promise<AuthenticatedPrincipal> {
  const { payload } = await jwtVerify(token, accessSecret);
  return {
    userId: String(payload.userId),
    email: String(payload.email),
    username: String(payload.username),
    role: String(payload.role ?? "user")
  };
}

export async function verifyRefreshToken(token: string): Promise<{ sessionId: string; userId: string }> {
  const { payload } = await jwtVerify(token, refreshSecret);
  return {
    sessionId: String(payload.sessionId),
    userId: String(payload.userId)
  };
}
