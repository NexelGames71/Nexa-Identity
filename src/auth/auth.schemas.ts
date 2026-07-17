import { z } from "zod";

const passwordSchema = z.string().min(10, "Password must be at least 10 characters.");

export const registerSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_.-]+$/),
  password: passwordSchema,
  displayName: z.string().min(1).max(80)
});

export const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
  deviceName: z.string().min(1).max(80).optional(),
  deviceType: z.string().max(40).optional(),
  platform: z.string().max(80).optional(),
  browser: z.string().max(80).optional()
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).optional()
});

export const logoutSchema = refreshSchema;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema
});

export const requestPasswordResetSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase())
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: passwordSchema
});
