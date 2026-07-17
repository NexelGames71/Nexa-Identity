import { prisma } from "../../config/database.js";

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function getAdminOverview() {
  const today = startOfToday();
  const [
    totalUsers,
    verifiedUsers,
    unverifiedUsers,
    newUsersToday,
    activeSessions,
    failedLoginsToday,
    betaUsers,
    browserBetaUsers,
    aiBetaUsers,
    emailsSentToday,
    activeAdminSessions,
    latestSignups,
    recentAuditEvents
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { emailVerified: true } }),
    prisma.user.count({ where: { emailVerified: false } }),
    prisma.user.count({ where: { createdAt: { gte: today } } }),
    prisma.session.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.auditLog.count({ where: { action: { contains: "failed_login" }, createdAt: { gte: today } } }),
    prisma.betaAccess.count({ where: { betaStatus: "active" } }),
    prisma.betaAccess.count({ where: { betaStatus: "active", products: { has: "nexa_browser" } } }),
    prisma.betaAccess.count({ where: { betaStatus: "active", products: { has: "nexa_ai" } } }),
    prisma.emailEvent.count({ where: { status: "sent", createdAt: { gte: today } } }),
    prisma.adminSession.count({ where: { revokedAt: null, expiresAt: { gt: new Date() } } }),
    prisma.user.findMany({
      select: { id: true, email: true, username: true, displayName: true, status: true, emailVerified: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 8
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 12
    })
  ]);

  return {
    stats: {
      totalUsers,
      verifiedUsers,
      unverifiedUsers,
      newUsersToday,
      activeSessions,
      failedLoginsToday,
      betaUsers,
      browserBetaUsers,
      aiBetaUsers,
      emailsSentToday,
      activeAdminSessions
    },
    latestSignups,
    recentAuditEvents
  };
}
