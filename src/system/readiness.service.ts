import { prisma } from "../config/database.js";
import { effectiveCorsAllowedOrigins, env, identityBaseUrl, isProduction } from "../config/env.js";
import { getBillingReadiness } from "../subscriptions/subscription.service.js";

export type ReadinessStatus = "ok" | "degraded" | "not_ready";

export interface ReadinessCheck {
  name: string;
  status: ReadinessStatus;
  message: string;
}

function statusFromChecks(checks: ReadinessCheck[]): ReadinessStatus {
  if (checks.some((check) => check.status === "not_ready")) {
    return "not_ready";
  }
  if (checks.some((check) => check.status === "degraded")) {
    return "degraded";
  }
  return "ok";
}

export function getConfigurationReadiness(): ReadinessCheck[] {
  const billing = getBillingReadiness();
  const checks: ReadinessCheck[] = [
    {
      name: "environment",
      status: isProduction ? "ok" : "degraded",
      message: isProduction ? "Running in production mode." : `Running in ${env.APP_ENV} mode.`
    },
    {
      name: "identity_base_url",
      status: env.IDENTITY_BASE_URL === identityBaseUrl && identityBaseUrl.startsWith("https://") ? "ok" : "not_ready",
      message:
        env.IDENTITY_BASE_URL === identityBaseUrl && identityBaseUrl.startsWith("https://")
          ? "Identity base URL targets the production domain."
          : "IDENTITY_BASE_URL must target the HTTPS production identity domain."
    },
    {
      name: "cors",
      status: effectiveCorsAllowedOrigins.includes(identityBaseUrl) ? "ok" : "not_ready",
      message: effectiveCorsAllowedOrigins.includes(identityBaseUrl)
        ? "Production origin is allowed."
        : "Production origin is missing from allowed CORS origins."
    },
    {
      name: "email",
      status: env.EMAIL_PROVIDER === "resend" && Boolean(env.RESEND_API_KEY || env.EMAIL_PROVIDER_API_KEY) ? "ok" : "not_ready",
      message:
        env.EMAIL_PROVIDER === "resend" && Boolean(env.RESEND_API_KEY || env.EMAIL_PROVIDER_API_KEY)
          ? "Resend email provider is configured."
          : "Production email requires EMAIL_PROVIDER=resend and RESEND_API_KEY."
    },
    {
      name: "billing",
      status: billing.checkoutEnabled ? "ok" : "degraded",
      message: billing.checkoutEnabled
        ? "Billing checkout provider is configured."
        : `Billing checkout is not fully configured: ${billing.missingConfiguration.join(", ") || "manual mode"}.`
    },
    {
      name: "owner_bootstrap",
      status: env.ALLOW_OWNER_BOOTSTRAP ? "not_ready" : "ok",
      message: env.ALLOW_OWNER_BOOTSTRAP ? "Owner bootstrap must be disabled." : "Owner bootstrap is disabled."
    },
    {
      name: "admin_dashboard",
      status: env.ADMIN_DASHBOARD_ENABLED ? "degraded" : "ok",
      message: env.ADMIN_DASHBOARD_ENABLED
        ? "Admin dashboard is enabled; verify HTTPS, IAM, RBAC, and IP allowlist before launch."
        : "Admin dashboard is disabled for public launch."
    }
  ];

  return checks;
}

export async function getReadiness() {
  const checks = getConfigurationReadiness();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ name: "database", status: "ok", message: "PostgreSQL database query succeeded." });
  } catch {
    checks.push({ name: "database", status: "not_ready", message: "Database query failed." });
  }

  return {
    service: "nexa-identity",
    status: statusFromChecks(checks),
    productionDomain: identityBaseUrl,
    checks
  };
}
