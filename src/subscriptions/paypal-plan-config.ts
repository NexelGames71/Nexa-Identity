import type { PlanId } from "../products/plan.service.js";

type PaidPlanId = Exclude<PlanId, "free">;

export interface PayPalPlanReference {
  planId: string;
  price: string;
  currency: "USD";
  unitName?: string;
}

export interface PayPalEnvironmentConfig {
  environment: "sandbox" | "live";
  productId: string;
  productName: string;
  plans: Record<PaidPlanId, PayPalPlanReference>;
}

export const paypalPlanConfig: Record<"sandbox" | "live", PayPalEnvironmentConfig> = {
  sandbox: {
    environment: "sandbox",
    productId: "PROD-9GS068028T509331F",
    productName: "Nexa AI Subscription",
    plans: {
      plus: { planId: "P-34S02331UM766023ENJDEEBI", price: "17.00", currency: "USD" },
      pro: { planId: "P-5HJ38874A10491711NJDEEBQ", price: "90.00", currency: "USD" },
      premium: { planId: "P-9UR24026186217055NJDEEBQ", price: "120.00", currency: "USD" },
      business: { planId: "P-7C61220049298562MNJDEEBY", price: "20.00", currency: "USD", unitName: "seat" }
    }
  },
  live: {
    environment: "live",
    productId: "PROD-06F53907CS3715546",
    productName: "Nexa AI Subscription",
    plans: {
      plus: { planId: "P-9X3232505F511992BNJDEJQY", price: "17.00", currency: "USD" },
      pro: { planId: "P-6CG00465ES661493JNJDEJQY", price: "90.00", currency: "USD" },
      premium: { planId: "P-1FM44767M6609432KNJDEJRA", price: "120.00", currency: "USD" },
      business: { planId: "P-8AW555793F363151WNJDEJRA", price: "20.00", currency: "USD", unitName: "seat" }
    }
  }
};

export function getDefaultPayPalPlanIds(environment: "sandbox" | "live") {
  return Object.fromEntries(
    Object.entries(paypalPlanConfig[environment].plans).map(([planId, reference]) => [planId, reference.planId])
  ) as Record<PaidPlanId, string>;
}

export function getPayPalEnvironmentConfig(environment: "sandbox" | "live") {
  return paypalPlanConfig[environment];
}
