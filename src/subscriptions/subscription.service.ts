import type { SubscriptionStatus } from "@prisma/client";
import { prisma } from "../config/database.js";
import { env } from "../config/env.js";
import { getPlan, plans } from "../products/plan.service.js";
import type { BillingProvider } from "./billing-provider.js";
import { BillingProviderUnavailableError, ManualBillingProvider } from "./billing-provider.js";
import { PayPalBillingProvider } from "./paypal-billing-provider.js";
import { getDefaultPayPalPlanIds, getPayPalEnvironmentConfig } from "./paypal-plan-config.js";

const billingProviders: Record<string, BillingProvider> = {
  manual: new ManualBillingProvider(),
  paypal: new PayPalBillingProvider()
};

export function getBillingProvider(name: string = env.BILLING_PROVIDER) {
  return billingProviders[name] ?? billingProviders.manual!;
}

export function getBillingReadiness() {
  const provider = getBillingProvider();
  const paypalPlanIds = parseConfiguredPayPalPlanIds();
  const paypalConfig = getPayPalEnvironmentConfig(env.PAYPAL_ENVIRONMENT);
  const missingPayPalConfig =
    provider.name === "paypal"
      ? [
          env.PAYPAL_CLIENT_ID ? null : "PAYPAL_CLIENT_ID",
          env.PAYPAL_CLIENT_SECRET ? null : "PAYPAL_CLIENT_SECRET",
          Object.keys(paypalPlanIds).length > 0 ? null : "PayPal plan map"
        ].filter(Boolean)
      : [];

  return {
    provider: provider.name,
    checkoutEnabled: provider.name === "paypal" && missingPayPalConfig.length === 0,
    manualAssignmentEnabled: true,
    missingConfiguration: missingPayPalConfig,
    paypal:
      provider.name === "paypal"
        ? {
            environment: paypalConfig.environment,
            productId: paypalConfig.productId,
            productName: paypalConfig.productName,
            configuredPlanCount: Object.keys(paypalPlanIds).length
          }
        : null
  };
}

export function listPlans() {
  return Object.values(plans);
}

export async function listUserSubscriptions(userId: string) {
  return prisma.subscription.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" }
  });
}

export async function manuallyAssignSubscription(params: {
  userId: string;
  planId: string;
  status?: SubscriptionStatus;
}) {
  const plan = getPlan(params.planId);
  return prisma.subscription.create({
    data: {
      userId: params.userId,
      billingProvider: "manual",
      billingCustomerId: `manual_${params.userId}`,
      planId: plan.id,
      status: params.status ?? "active",
      currentPeriodStart: new Date()
    }
  });
}

export async function createCheckoutSession(params: {
  userId: string;
  planId: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const plan = getPlan(params.planId);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: params.userId } });
  const provider = getBillingProvider();
  const customer = await provider.createCustomer({
    userId: user.id,
    email: user.email,
    displayName: user.displayName
  });

  try {
    const checkout = await provider.createCheckoutSession({
      userId: user.id,
      planId: plan.id,
      billingCustomerId: customer.id,
      billingCustomerEmail: customer.email,
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl
    });

    await prisma.subscription.create({
      data: {
        userId: user.id,
        billingProvider: provider.name,
        billingCustomerId: customer.id,
        billingSubscriptionId: checkout.externalId,
        planId: plan.id,
        status: "trialing",
        currentPeriodStart: new Date()
      }
    });

    return checkout;
  } catch (error) {
    if (error instanceof BillingProviderUnavailableError) {
      throw error;
    }

    throw new BillingProviderUnavailableError("Billing checkout is unavailable.");
  }
}

export async function cancelSubscription(params: { userId: string; subscriptionId: string }) {
  const subscription = await prisma.subscription.findFirstOrThrow({
    where: { id: params.subscriptionId, userId: params.userId }
  });
  const provider = getBillingProvider(subscription.billingProvider);
  await provider.cancelSubscription({ billingSubscriptionId: subscription.billingSubscriptionId ?? subscription.id });

  return prisma.subscription.update({
    where: { id: subscription.id },
    data: { cancelAtPeriodEnd: true }
  });
}

function parseConfiguredPayPalPlanIds() {
  try {
    const configured = JSON.parse(env.PAYPAL_PLAN_IDS) as Record<string, string | undefined>;
    const overrides = Object.fromEntries(Object.entries(configured).filter(([, planId]) => Boolean(planId)));
    const value = { ...getDefaultPayPalPlanIds(env.PAYPAL_ENVIRONMENT), ...overrides };
    return Object.fromEntries(Object.entries(value).filter(([, planId]) => Boolean(planId)));
  } catch {
    return getDefaultPayPalPlanIds(env.PAYPAL_ENVIRONMENT);
  }
}
