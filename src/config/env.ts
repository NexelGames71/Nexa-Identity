import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  APP_ENV: z.enum(["development", "testing", "production"]).default("development"),
  APP_PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_PROVIDER: z.literal("prisma").default("prisma"),
  DATABASE_URL: z.string().optional().default(""),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default("30d"),
  CORS_ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_PUBLISHABLE_KEY: z.string().optional().default(""),
  SUPABASE_SECRET_KEY: z.string().optional().default(""),
  SUPABASE_JWKS_URL: z.string().url().optional(),
  SUPABASE_OIDC_TOKEN_ENDPOINT: z.string().url().optional(),
  SUPABASE_OIDC_AUTHORIZATION_ENDPOINT: z.string().url().optional(),
  SUPABASE_OIDC_DISCOVERY_URL: z.string().url().optional(),
  EMAIL_PROVIDER: z.enum(["development", "resend", "disabled"]).default("development"),
  EMAIL_PROVIDER_API_KEY: z.string().optional().default(""),
  RESEND_API_KEY: z.string().optional().default(""),
  EMAIL_FROM: z.string().optional().default("Nexa <noreply@nexa.ai>"),
  ADMIN_EMAIL_FROM: z.string().optional().default("Nexa Admin <admin@admin.nexaidentity.com>"),
  IDENTITY_BASE_URL: z.string().url().optional(),
  BILLING_PROVIDER_SECRET: z.string().optional().default(""),
  BILLING_PROVIDER: z.enum(["manual", "paypal"]).default("manual"),
  PAYPAL_CLIENT_ID: z.string().optional().default(""),
  PAYPAL_CLIENT_SECRET: z.string().optional().default(""),
  PAYPAL_ENVIRONMENT: z.enum(["sandbox", "live"]).default("sandbox"),
  PAYPAL_PLAN_IDS: z.string().optional().default("{}"),
  ADMIN_DASHBOARD_ENABLED: z.coerce.boolean().default(false),
  ADMIN_DASHBOARD_HOST: z.string().default("127.0.0.1"),
  ADMIN_DASHBOARD_PORT: z.coerce.number().int().positive().default(3001),
  ADMIN_ALLOW_LAN: z.coerce.boolean().default(false),
  ADMIN_ALLOWED_IPS: z.string().default("127.0.0.1,::1"),
  ADMIN_SESSION_EXPIRES_IN: z.string().default("2h"),
  ADMIN_REQUIRE_HTTPS: z.coerce.boolean().default(false),
  ALLOW_OWNER_BOOTSTRAP: z.coerce.boolean().default(false),
  OWNER_BOOTSTRAP_TOKEN: z.string().optional().default("")
});

export const env = envSchema.parse(process.env);

export const identityBaseUrl =
  env.IDENTITY_BASE_URL ?? (env.APP_ENV === "production" ? "https://identity.trynexa-ai.com" : `http://localhost:${env.APP_PORT}`);

function isPlaceholderSecret(value: string) {
  return value.includes("replace-with") || value.includes("change-me") || value.includes("your-");
}

function validateProductionEnv() {
  if (env.APP_ENV !== "production") {
    return;
  }

  const errors: string[] = [];
  if (isPlaceholderSecret(env.JWT_ACCESS_SECRET) || isPlaceholderSecret(env.JWT_REFRESH_SECRET)) {
    errors.push("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be real rotated production secrets.");
  }
  if (!env.DATABASE_URL) {
    errors.push("DATABASE_URL is required when DATABASE_PROVIDER=prisma.");
  }
  if (env.DATABASE_URL.includes("localhost") || env.DATABASE_URL.includes("127.0.0.1")) {
    errors.push("DATABASE_URL must point to managed production PostgreSQL, not localhost.");
  }
  if (env.EMAIL_PROVIDER !== "resend" || !env.RESEND_API_KEY && !env.EMAIL_PROVIDER_API_KEY) {
    errors.push("EMAIL_PROVIDER=resend and RESEND_API_KEY are required in production.");
  }
  if (!env.IDENTITY_BASE_URL) {
    errors.push("IDENTITY_BASE_URL is required in production.");
  }
  if (env.IDENTITY_BASE_URL && !env.IDENTITY_BASE_URL.startsWith("https://")) {
    errors.push("IDENTITY_BASE_URL must use https in production.");
  }
  if (env.ALLOW_OWNER_BOOTSTRAP) {
    errors.push("ALLOW_OWNER_BOOTSTRAP must be false after the first production owner is created.");
  }
  if (env.ADMIN_DASHBOARD_ENABLED && !env.ADMIN_REQUIRE_HTTPS) {
    errors.push("ADMIN_REQUIRE_HTTPS=true is required when the admin dashboard is enabled in production.");
  }
  if (env.ADMIN_DASHBOARD_ENABLED && env.ADMIN_ALLOWED_IPS.trim().length === 0) {
    errors.push("ADMIN_ALLOWED_IPS must be configured when the admin dashboard is enabled in production.");
  }

  if (errors.length > 0) {
    throw new Error(`Unsafe production configuration:\n- ${errors.join("\n- ")}`);
  }
}

validateProductionEnv();

export const corsAllowedOrigins = env.CORS_ALLOWED_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const productionAppOrigins = [identityBaseUrl];
export const localAppOrigins =
  env.APP_ENV === "production" ? [] : [`http://localhost:${env.APP_PORT}`, `http://127.0.0.1:${env.APP_PORT}`];

export const effectiveCorsAllowedOrigins = Array.from(
  new Set([...corsAllowedOrigins, ...localAppOrigins, ...productionAppOrigins])
);

export const isProduction = env.APP_ENV === "production";
