import type { AdminRoleName } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { permissionsForRole } from "./admin-permission.service.js";

export async function getActiveAdminRole(userId: string) {
  return prisma.adminRole.findFirst({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "asc" }
  });
}

export async function assignAdminRole(params: {
  userId: string;
  role: AdminRoleName;
  createdBy?: string;
  permissions?: string[];
}) {
  return prisma.adminRole.create({
    data: {
      userId: params.userId,
      role: params.role,
      createdBy: params.createdBy,
      permissions: params.permissions ?? permissionsForRole(params.role)
    }
  });
}

export async function ownerExists() {
  const owner = await prisma.adminRole.findFirst({
    where: { role: "owner", revokedAt: null },
    select: { id: true }
  });
  return Boolean(owner);
}

export async function activeOwnerCount(excludeRoleId?: string) {
  return prisma.adminRole.count({
    where: {
      role: "owner",
      revokedAt: null,
      ...(excludeRoleId ? { id: { not: excludeRoleId } } : {})
    }
  });
}

export async function listAdminRoles() {
  return prisma.adminRole.findMany({
    where: { revokedAt: null },
    include: {
      user: { select: { id: true, email: true, username: true, displayName: true, status: true } },
      creator: { select: { id: true, email: true, displayName: true } }
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }]
  });
}

export async function replaceActiveAdminRole(params: {
  userId: string;
  role: AdminRoleName;
  createdBy: string;
  permissions?: string[];
}) {
  return prisma.$transaction(async (tx) => {
    await tx.adminRole.updateMany({
      where: { userId: params.userId, revokedAt: null },
      data: { revokedAt: new Date() }
    });
    return tx.adminRole.create({
      data: {
        userId: params.userId,
        role: params.role,
        createdBy: params.createdBy,
        permissions: params.permissions ?? permissionsForRole(params.role)
      },
      include: {
        user: { select: { id: true, email: true, username: true, displayName: true, status: true } },
        creator: { select: { id: true, email: true, displayName: true } }
      }
    });
  });
}
