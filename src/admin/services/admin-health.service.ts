import { prisma } from "../../config/database.js";
import { env, isProduction } from "../../config/env.js";

export async function getAdminSystemHealth() {
  let database: "ok" | "error" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = "error";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [recentFailedLogins, emailsSentToday, authErrorsToday, activeAdminSessions] = await Promise.all([
    prisma.auditLog.count({ where: { action: { contains: "failed_login" }, createdAt: { gte: today } } }),
    prisma.emailEvent.count({ where: { status: "sent", createdAt: { gte: today } } }),
    prisma.auditLog.count({ where: { action: { contains: "auth" }, createdAt: { gte: today } } }),
    prisma.adminSession.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } })
  ]);

  return {
    service: "nexa-identity",
    api: "ok",
    database,
    databaseProvider: env.DATABASE_PROVIDER,
    emailProvider: env.EMAIL_PROVIDER,
    queue: "not_configured",
    recentFailedLogins,
    emailsSentToday,
    authErrorsToday,
    activeAdminSessions,
    environment: env.APP_ENV,
    production: isProduction,
    admin: {
      dashboardEnabled: env.ADMIN_DASHBOARD_ENABLED,
      allowLan: env.ADMIN_ALLOW_LAN,
      allowedIpsConfigured: env.ADMIN_ALLOWED_IPS.length > 0,
      httpsRequired: env.ADMIN_REQUIRE_HTTPS,
      sessionExpiresIn: env.ADMIN_SESSION_EXPIRES_IN
    }
  };
}
