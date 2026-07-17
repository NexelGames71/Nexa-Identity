import type { EntitlementStatus } from "@prisma/client";
import { prisma } from "../../config/database.js";
import { getPlan } from "../../products/plan.service.js";
import { ensureDefaultProducts } from "../../products/entitlement.service.js";

export async function listAdminEntitlements(userId: string) {
  return prisma.productEntitlement.findMany({
    where: { userId },
    include: { product: true },
    orderBy: { productId: "asc" }
  });
}

export async function upsertAdminEntitlement(params: {
  userId: string;
  productId: string;
  plan: string;
  status: EntitlementStatus;
  startsAt?: Date;
  expiresAt?: Date | null;
  limits?: object;
  metadata?: object;
}) {
  await ensureDefaultProducts();
  const plan = getPlan(params.plan);
  return prisma.productEntitlement.upsert({
    where: { userId_productId: { userId: params.userId, productId: params.productId } },
    create: {
      userId: params.userId,
      productId: params.productId,
      plan: params.plan,
      status: params.status,
      startsAt: params.startsAt,
      expiresAt: params.expiresAt,
      limits: params.limits ?? plan.limits,
      metadata: params.metadata ?? { source: "admin" }
    },
    update: {
      plan: params.plan,
      status: params.status,
      startsAt: params.startsAt,
      expiresAt: params.expiresAt,
      limits: params.limits ?? plan.limits,
      metadata: params.metadata ?? { source: "admin" }
    },
    include: { product: true }
  });
}

export async function updateAdminEntitlement(params: {
  entitlementId: string;
  userId: string;
  plan?: string;
  status?: EntitlementStatus;
  startsAt?: Date;
  expiresAt?: Date | null;
  limits?: object;
  metadata?: object;
}) {
  const existing = await prisma.productEntitlement.findFirst({
    where: { id: params.entitlementId, userId: params.userId }
  });
  if (!existing) {
    return null;
  }

  const planId = params.plan ?? existing.plan;
  const plan = getPlan(planId);
  return prisma.productEntitlement.update({
    where: { id: existing.id },
    data: {
      plan: params.plan,
      status: params.status,
      startsAt: params.startsAt,
      expiresAt: params.expiresAt,
      limits: params.limits ?? (params.plan ? plan.limits : undefined),
      metadata: params.metadata
    },
    include: { product: true }
  });
}

export async function disableAdminEntitlement(userId: string, entitlementId: string) {
  return prisma.productEntitlement.updateMany({
    where: { id: entitlementId, userId },
    data: { status: "disabled" }
  });
}
