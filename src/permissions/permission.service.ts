import { prisma } from "../config/database.js";
import { permissionScopes } from "./scopes.js";

export async function initializeDefaultPermissions(userId: string) {
  await prisma.permission.createMany({
    data: permissionScopes.map((scope) => ({
      userId,
      scope,
      value: false,
      source: "default"
    })),
    skipDuplicates: true
  });
}

export async function getUserPermissions(userId: string) {
  return prisma.permission.findMany({
    where: { userId },
    orderBy: { scope: "asc" }
  });
}

export async function upsertPermission(userId: string, scope: string, value: boolean, source = "user") {
  return prisma.permission.upsert({
    where: { userId_scope: { userId, scope } },
    create: { userId, scope, value, source },
    update: { value, source }
  });
}
