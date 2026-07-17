export type PlanId = "free" | "plus" | "pro" | "premium" | "business";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  limits: Record<string, number | boolean | string>;
  features: string[];
}

export const plans: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    limits: { messagesPerDay: 50, storageGb: 5, apiKeys: 1 },
    features: ["basic_chat", "page_summarization", "browser_login"]
  },
  plus: {
    id: "plus",
    name: "Plus",
    limits: { messagesPerDay: 500, storageGb: 25, apiKeys: 5 },
    features: ["basic_chat", "chat_history", "memory", "basic_skills", "page_summarization"]
  },
  pro: {
    id: "pro",
    name: "Pro",
    limits: { messagesPerDay: 2000, storageGb: 100, apiKeys: 20 },
    features: ["advanced_models", "automations", "voice", "agents", "cloud_dashboard"]
  },
  premium: {
    id: "premium",
    name: "Premium",
    limits: { messagesPerDay: 5000, storageGb: 500, apiKeys: 50 },
    features: ["advanced_models", "deep_thinker", "priority_compute", "gpu_preview"]
  },
  business: {
    id: "business",
    name: "Business",
    limits: { messagesPerDay: 10000, storageGb: 1000, apiKeys: 200 },
    features: ["team_billing", "admin_controls", "enterprise_audit", "sso_ready"]
  }
};

export function getPlan(planId: string): PlanDefinition {
  return plans[(planId.toLowerCase() as PlanId)] ?? plans.free;
}
