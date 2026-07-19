import { Router } from "express";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../config/database.js";
import { isProduction } from "../config/env.js";
import { authenticate } from "../middleware/authenticate.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler } from "../utils/async-handler.js";
import { sendError, sendSuccess } from "../utils/api-response.js";
import { auditLog } from "../audit/audit.service.js";
import { hashPassword, verifyPassword } from "../security/password.js";
import { getUserEntitlements } from "../products/entitlement.service.js";
import { getUserPermissions } from "../permissions/permission.service.js";
import { presentUser } from "../users/user.presenter.js";
import {
  changePasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  requestPasswordResetSchema,
  resetPasswordSchema
} from "./auth.schemas.js";
import { loginUser, logout, refreshTokens, registerUser } from "./auth.service.js";
import { exchangeAuthCode, issueAuthCode } from "./auth-code.service.js";
import {
  consumeEmailVerificationToken,
  consumePasswordResetToken,
  createPasswordResetToken
} from "./account-token.service.js";
import { clearAuthCookies, setAuthCookies } from "./cookie.service.js";
import { sendPasswordReset } from "../email/email.service.js";
import { SupabaseAuthConfigError, SupabaseAuthRequestError } from "./supabase-auth.service.js";

export const authRouter = Router();

function isDatabaseUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";

  return (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P1001") ||
    (message.includes("prepared statement") && message.includes("does not exist"))
  );
}

function isDuplicateAccountError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("unique constraint") ||
    message.includes("already registered") ||
    message.includes("already exists") ||
    message.includes("user already");
}

authRouter.post(
  "/register",
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    try {
      const result = await registerUser(req.body, req);
      return sendSuccess(
        res,
        {
          user: result.user,
          emailVerificationRequired: true,
          emailVerificationSent: result.emailVerificationSent,
          emailVerificationToken: isProduction ? undefined : result.emailVerificationToken
        },
        201
      );
    } catch (error) {
      if (isDuplicateAccountError(error)) {
        return sendError(res, 409, "conflict", "Email or username is already registered.");
      }
      if (isDatabaseUnavailable(error)) {
        console.error("Registration database unavailable.", error);
        return sendError(res, 503, "service_unavailable", "Nexa Identity is temporarily unable to reach the account database.");
      }
      if (error instanceof SupabaseAuthConfigError) {
        console.error("Registration Supabase Auth configuration is missing.");
        return sendError(res, 503, "service_unavailable", "Nexa Identity account creation is temporarily unavailable.");
      }
      if (error instanceof SupabaseAuthRequestError) {
        console.error("Registration Supabase Auth request failed.", {
          status: error.status,
          message: error.message
        });
        return sendError(
          res,
          error.status === 409 || isDuplicateAccountError(error) ? 409 : 503,
          error.status === 409 || isDuplicateAccountError(error) ? "conflict" : "service_unavailable",
          error.status === 409 || isDuplicateAccountError(error)
            ? "Email or username is already registered."
            : "Nexa Identity account creation is temporarily unavailable."
        );
      }
      throw error;
    }
  })
);

authRouter.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    try {
      const result = await loginUser(req.body, req);
      setAuthCookies(res, result.tokens);
      return sendSuccess(res, result);
    } catch {
      return sendError(res, 401, "unauthorized", "Invalid credentials or account is locked.");
    }
  })
);

authRouter.post(
  "/refresh",
  validateBody(refreshSchema),
  asyncHandler(async (req, res) => {
    try {
      const refreshToken = req.body.refreshToken ?? req.cookies?.nexa_refresh_token;
      if (typeof refreshToken !== "string") {
        return sendError(res, 401, "unauthorized", "Refresh token is required.");
      }

      const tokens = await refreshTokens(refreshToken, req);
      setAuthCookies(res, tokens);
      return sendSuccess(res, { tokens });
    } catch {
      return sendError(res, 401, "unauthorized", "Refresh token is invalid or expired.");
    }
  })
);

authRouter.post(
  "/logout",
  validateBody(logoutSchema),
  asyncHandler(async (req, res) => {
    try {
      const refreshToken = req.body.refreshToken ?? req.cookies?.nexa_refresh_token;
      if (typeof refreshToken !== "string") {
        return sendError(res, 401, "unauthorized", "Refresh token is required.");
      }

      await logout(refreshToken, req);
    } catch {
      return sendError(res, 401, "unauthorized", "Refresh token is invalid or expired.");
    }
    clearAuthCookies(res);
    return sendSuccess(res, { loggedOut: true });
  })
);

authRouter.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.principal!.userId },
      include: { profile: true }
    });

    return sendSuccess(res, {
      user: presentUser(user),
      entitlements: await getUserEntitlements(user.id),
      permissions: await getUserPermissions(user.id)
    });
  })
);

authRouter.post(
  "/verify-email",
  validateBody(z.object({ token: z.string().min(1) })),
  asyncHandler(async (req, res) => {
    const userId = await consumeEmailVerificationToken(req.body.token);
    if (!userId) {
      return sendError(res, 400, "bad_request", "Email verification token is invalid or expired.");
    }

    await auditLog({ req, userId, action: "email.verified" });
    return sendSuccess(res, { verified: true });
  })
);

authRouter.post(
  "/password-reset/request",
  validateBody(requestPasswordResetSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { email: req.body.email } });
    let resetToken: string | undefined;
    if (user) {
      resetToken = await createPasswordResetToken(user.id);
      await sendPasswordReset({ to: user.email, token: resetToken });
      await auditLog({ req, userId: user.id, action: "password_reset.requested" });
    }
    return sendSuccess(res, { requested: true, resetToken: isProduction ? undefined : resetToken });
  })
);

authRouter.post(
  "/password-reset/confirm",
  validateBody(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const userId = await consumePasswordResetToken(req.body.token);
    if (!userId) {
      return sendError(res, 400, "bad_request", "Password reset token is invalid or expired.");
    }

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(req.body.newPassword), failedLoginCount: 0, lockedUntil: null }
    });
    await prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await auditLog({ req, userId, action: "password_reset.completed" });
    return sendSuccess(res, { reset: true });
  })
);

authRouter.post(
  "/change-password",
  authenticate,
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.principal!.userId } });
    if (!user) {
      return sendError(res, 404, "not_found", "User was not found.");
    }
    if (!(await verifyPassword(req.body.currentPassword, user.passwordHash))) {
      return sendError(res, 403, "forbidden", "Current password is incorrect.");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(req.body.newPassword) }
    });
    await prisma.session.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } });
    await auditLog({ req, userId: user.id, action: "password.changed" });
    return sendSuccess(res, { changed: true });
  })
);

authRouter.post(
  "/verify-token",
  authenticate,
  asyncHandler(async (req, res) => {
    return sendSuccess(res, { principal: req.principal });
  })
);

authRouter.post(
  "/authorize-code",
  authenticate,
  validateBody(
    z.object({
      clientId: z.string().min(1).default("nexa-web"),
      redirectUri: z.string().url(),
      returnTo: z.string().url()
    })
  ),
  asyncHandler(async (req, res) => {
    try {
      const code = await issueAuthCode({
        userId: req.principal!.userId,
        clientId: req.body.clientId,
        redirectUri: req.body.redirectUri,
        returnTo: req.body.returnTo
      });
      return sendSuccess(res, code);
    } catch (error) {
      return sendError(res, 400, "bad_request", error instanceof Error ? error.message : "Could not issue authorization code.");
    }
  })
);

authRouter.post(
  "/exchange-code",
  validateBody(
    z.object({
      code: z.string().min(16),
      clientId: z.string().min(1).default("nexa-web"),
      redirectUri: z.string().url()
    })
  ),
  asyncHandler(async (req, res) => {
    try {
      const result = await exchangeAuthCode({
        code: req.body.code,
        clientId: req.body.clientId,
        redirectUri: req.body.redirectUri,
        req
      });
      setAuthCookies(res, result.tokens);
      return sendSuccess(res, result);
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        console.error("Authorization code exchange database unavailable.", error);
        return sendError(
          res,
          503,
          "service_unavailable",
          "Nexa Identity is temporarily unable to complete sign in. Please try again."
        );
      }

      return sendError(res, 401, "unauthorized", "Authorization code is invalid or expired.");
    }
  })
);

authRouter.patch(
  "/profile",
  authenticate,
  validateBody(
    z.object({
      displayName: z.string().min(1).max(80).optional(),
      username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/).optional(),
      firstName: z.string().max(80).optional(),
      lastName: z.string().max(80).optional(),
      country: z.string().max(80).optional(),
      timezone: z.string().max(80).optional(),
      language: z.string().max(40).optional(),
      bio: z.string().max(500).optional()
    })
  ),
  asyncHandler(async (req, res) => {
    const { displayName, username, ...profile } = req.body;
    const user = await prisma.user.update({
      where: { id: req.principal!.userId },
      data: {
        displayName,
        username,
        profile: { upsert: { create: profile, update: profile } }
      },
      include: { profile: true }
    });

    await auditLog({ req, userId: user.id, action: "profile.updated" });
    return sendSuccess(res, { user: presentUser(user) });
  })
);
