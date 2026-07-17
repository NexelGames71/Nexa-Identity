import { prisma } from "../../config/database.js";

const safeUserSelect = {
  id: true,
  email: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  emailVerified: true,
  status: true,
  failedLoginCount: true,
  lockedUntil: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  betaAccess: true,
  _count: {
    select: {
      sessions: true,
      devices: true,
      entitlements: true,
      permissions: true,
      apiKeys: true,
      auditLogs: true
    }
  }
} as const;

export async function listAdminUsers(params: { q?: string; status?: string; take?: number; skip?: number }) {
  const take = Math.min(Math.max(params.take ?? 25, 1), 100);
  const skip = Math.max(params.skip ?? 0, 0);
  const where = {
    ...(params.status ? { status: params.status as never } : {}),
    ...(params.q
      ? {
          OR: [
            { id: params.q },
            { email: { contains: params.q, mode: "insensitive" as const } },
            { username: { contains: params.q, mode: "insensitive" as const } },
            { displayName: { contains: params.q, mode: "insensitive" as const } }
          ]
        }
      : {})
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: safeUserSelect,
      orderBy: { createdAt: "desc" },
      take,
      skip
    }),
    prisma.user.count({ where })
  ]);

  return { users, pagination: { take, skip, total } };
}

export async function getAdminUserDetail(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...safeUserSelect,
      profile: true,
      entitlements: { orderBy: { createdAt: "desc" }, include: { product: true } },
      permissions: { orderBy: { scope: "asc" } },
      betaAccess: true,
      subscriptions: { orderBy: { createdAt: "desc" } },
      apiKeys: {
        select: {
          id: true,
          name: true,
          prefix: true,
          scopes: true,
          lastUsedAt: true,
          expiresAt: true,
          revokedAt: true,
          createdAt: true
        },
        orderBy: { createdAt: "desc" }
      },
      supportNotesTarget: {
        include: { adminUser: { select: { id: true, email: true, displayName: true } } },
        orderBy: { createdAt: "desc" },
        take: 20
      },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 25 }
    }
  });
}
