import { prisma } from "../config/database.js";
import { auditLog } from "../audit/audit.service.js";
import { assignDefaultEntitlements, getUserEntitlements } from "../products/entitlement.service.js";
import { initializeDefaultPermissions } from "../permissions/permission.service.js";
import { sha256 } from "../security/hash.js";
import { hashPassword, verifyPassword } from "../security/password.js";
import { presentUser } from "../users/user.presenter.js";
import { addDuration } from "../utils/time.js";
import { env } from "../config/env.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "./token.service.js";
import type { Request } from "express";
import { createEmailVerificationToken } from "./account-token.service.js";
import { sendEmailVerification } from "../email/email.service.js";
import { createSupabaseAuthUser, deleteSupabaseAuthUser } from "./supabase-auth.service.js";

const LOCK_AFTER_FAILURES = 8;
const LOCK_DURATION_MS = 15 * 60 * 1000;

function principalFromUser(user: { id: string; email: string; username: string; role: string }) {
  return { userId: user.id, email: user.email, username: user.username, role: user.role };
}

export async function createTokenSession(params: {
  user: { id: string; email: string; username: string; role: string };
  req?: Request;
  device?: { deviceName?: string; deviceType?: string; platform?: string; browser?: string };
}) {
  const device = await prisma.device.create({
    data: {
      userId: params.user.id,
      deviceName: params.device?.deviceName ?? "Unknown device",
      deviceType: params.device?.deviceType,
      platform: params.device?.platform,
      browser: params.device?.browser,
      lastIpAddress: params.req?.ip,
      lastActiveAt: new Date()
    }
  });

  const expiresAt = addDuration(new Date(), env.REFRESH_TOKEN_EXPIRES_IN);
  const session = await prisma.session.create({
    data: {
      userId: params.user.id,
      deviceId: device.id,
      refreshTokenHash: "pending",
      ipAddress: params.req?.ip,
      userAgent: params.req?.get("user-agent"),
      expiresAt
    }
  });

  const refresh = await signRefreshToken(session.id, params.user.id);
  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: sha256(refresh.token),
      expiresAt: refresh.expiresAt
    }
  });

  const access = await signAccessToken(principalFromUser(params.user));
  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    accessTokenExpiresAt: access.expiresAt,
    refreshTokenExpiresAt: refresh.expiresAt
  };
}

export async function registerUser(input: {
  email: string;
  username: string;
  password: string;
  displayName: string;
}, req?: Request) {
  const existingUser = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { username: input.username }] },
    select: { id: true }
  });
  if (existingUser) {
    throw new Error("Email or username is already registered.");
  }

  const supabaseUser = await createSupabaseAuthUser({
    email: input.email,
    username: input.username,
    displayName: input.displayName,
    password: input.password,
    emailConfirmed: false
  });
  const passwordHash = await hashPassword(input.password);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        supabaseAuthUserId: supabaseUser.id,
        email: input.email,
        username: input.username,
        displayName: input.displayName,
        passwordHash,
        status: "pending_verification",
        profile: { create: {} }
      },
      include: { profile: true }
    });
  } catch (error) {
    await deleteSupabaseAuthUser(supabaseUser.id).catch(() => undefined);
    throw error;
  }

  const [emailVerificationToken] = await Promise.all([
    createEmailVerificationToken(user.id),
    assignDefaultEntitlements(user.id),
    initializeDefaultPermissions(user.id)
  ]);

  void sendEmailVerification({ to: user.email, token: emailVerificationToken }).catch((error) => {
    console.error("Email verification delivery failed.", {
      userId: user.id,
      error: error instanceof Error ? error.message : "Unknown email provider error."
    });
  });

  void auditLog({ req, userId: user.id, action: "user.registered", resourceType: "user", resourceId: user.id }).catch((error) => {
    console.error("Registration audit log failed.", {
      userId: user.id,
      error: error instanceof Error ? error.message : "Unknown audit log error."
    });
  });

  return { user: presentUser(user), emailVerificationToken, emailVerificationSent: true };
}

export async function loginUser(input: {
  identifier: string;
  password: string;
  deviceName?: string;
  deviceType?: string;
  platform?: string;
  browser?: string;
}, req?: Request) {
  const identifier = input.identifier.toLowerCase();
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { username: input.identifier }] },
    include: { profile: true }
  });

  if (!user || user.status === "disabled") {
    throw new Error("Invalid credentials.");
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new Error("Account is temporarily locked.");
  }

  const validPassword = await verifyPassword(input.password, user.passwordHash);
  if (!validPassword) {
    const failedLoginCount = user.failedLoginCount + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount,
        lockedUntil:
          failedLoginCount >= LOCK_AFTER_FAILURES ? new Date(Date.now() + LOCK_DURATION_MS) : null
      }
    });
    await auditLog({ req, userId: user.id, action: "user.login_failed", resourceType: "user", resourceId: user.id });
    throw new Error("Invalid credentials.");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null }
  });

  const tokens = await createTokenSession({ user, req, device: input });
  const entitlements = await getUserEntitlements(user.id);
  await auditLog({ req, userId: user.id, action: "user.logged_in", resourceType: "user", resourceId: user.id });

  return {
    tokens,
    user: presentUser(user),
    entitlements,
    settings: { memoryEnabled: false, trainingOptIn: false }
  };
}

export async function refreshTokens(refreshToken: string, req?: Request) {
  const payload = await verifyRefreshToken(refreshToken);

  const session = await prisma.session.findUnique({
    where: { id: payload.sessionId },
    include: { user: true }
  });

  if (!session || session.revokedAt || session.expiresAt <= new Date()) {
    throw new Error("Refresh token is invalid or expired.");
  }

  if (session.refreshTokenHash !== sha256(refreshToken)) {
    await prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    throw new Error("Refresh token reuse detected.");
  }

  const refresh = await signRefreshToken(session.id, session.userId);
  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshTokenHash: sha256(refresh.token),
      expiresAt: refresh.expiresAt,
      ipAddress: req?.ip,
      userAgent: req?.get("user-agent")
    }
  });

  if (session.deviceId) {
    await prisma.device.update({
      where: { id: session.deviceId },
      data: { lastActiveAt: new Date(), lastIpAddress: req?.ip }
    });
  }

  const access = await signAccessToken(principalFromUser(session.user));
  return {
    accessToken: access.token,
    refreshToken: refresh.token,
    accessTokenExpiresAt: access.expiresAt,
    refreshTokenExpiresAt: refresh.expiresAt
  };
}

export async function logout(refreshToken: string, req?: Request) {
  const payload = await verifyRefreshToken(refreshToken);

  await prisma.session.updateMany({
    where: { id: payload.sessionId, refreshTokenHash: sha256(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() }
  });
  await auditLog({ req, userId: payload.userId, action: "user.logged_out", resourceType: "session", resourceId: payload.sessionId });
}
