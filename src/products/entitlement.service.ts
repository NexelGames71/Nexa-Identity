import { prisma } from "../config/database.js";
import { getPlan } from "./plan.service.js";
import { defaultProducts } from "./products.js";

export async function ensureDefaultProducts() {
  await Promise.all(
    defaultProducts.map((product) =>
      prisma.product.upsert({
        where: { id: product.id },
        update: { name: product.name },
        create: product
      })
    )
  );
}

export async function assignDefaultEntitlements(userId: string) {
  await ensureDefaultProducts();

  await prisma.productEntitlement.createMany({
    data: [
      {
        userId,
        productId: "nexa_ai",
        plan: "free",
        limits: getPlan("free").limits,
        metadata: { source: "registration" }
      },
      {
        userId,
        productId: "nexa_browser",
        plan: "free",
        limits: getPlan("free").limits,
        metadata: { source: "registration" }
      },
      {
        userId,
        productId: "nexa_cloud",
        plan: "free",
        limits: getPlan("free").limits,
        metadata: { source: "registration" }
      }
    ],
    skipDuplicates: true
  });
}

export async function getUserEntitlements(userId: string) {
  const entitlements = await prisma.productEntitlement.findMany({
    where: { userId },
    include: { product: true },
    orderBy: { productId: "asc" }
  });

  return entitlements.map((entitlement) => {
    const plan = getPlan(entitlement.plan);
    return {
      id: entitlement.id,
      product: entitlement.product,
      plan: entitlement.plan,
      status: entitlement.status,
      limits: entitlement.limits,
      features: plan.features,
      expiration: entitlement.expiresAt,
      startsAt: entitlement.startsAt
    };
  });
}

export async function checkUserFeatureAccess(params: {
  userId: string;
  productId?: string;
  feature: string;
}) {
  const entitlements = await getUserEntitlements(params.userId);
  const matchingEntitlements = params.productId
    ? entitlements.filter((entitlement) => entitlement.product.id === params.productId)
    : entitlements;

  const entitlement = matchingEntitlements.find(
    (entry) => entry.status === "active" && entry.features.includes(params.feature)
  );

  return {
    allowed: Boolean(entitlement),
    feature: params.feature,
    productId: params.productId,
    entitlement: entitlement ?? null
  };
}
