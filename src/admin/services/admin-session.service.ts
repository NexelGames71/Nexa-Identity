import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import { secureRandomToken, sha256 } from "../../security/hash.js";
import { addDuration } from "../../utils/time.js";
import type { AdminRoleName } from "@prisma/client";

export async function createAdminSession(params: {
  adminUserId: string;
  role: AdminRoleName;
  ipAddress?: string;
  userAgent?: string;
}) {
  const token = secureRandomToken(48);
  const expiresAt = addDuration(new Date(), env.ADMIN_SESSION_EXPIRES_IN);
  const session = await prisma.adminSession.create({
    data: {
      adminUserId: params.adminUserId,
      role: params.role,
      sessionTokenHash: sha256(token),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      expiresAt
    }
  });

  return { token, session };
}

export async function verifyAdminSession(token: string) {
  const session = await prisma.adminSession.findFirst({
    where: {
      sessionTokenHash: sha256(token),
      revokedAt: null,
      expiresAt: { gt: new Date() }
    },
    include: {
      adminUser: {
        include: {
          adminRoles: {
            where: { revokedAt: null },
            orderBy: { createdAt: "asc" }
          }
        }
      }
    }
  });

  if (!session) {
    return null;
  }

  await prisma.adminSession.update({
    where: { id: session.id },
    data: { lastActiveAt: new Date() }
  });

  return session;
}

export async function revokeAdminSession(token: string) {
  await prisma.adminSession.updateMany({
    where: { sessionTokenHash: sha256(token), revokedAt: null },
    data: { revokedAt: new Date() }
  });
}
