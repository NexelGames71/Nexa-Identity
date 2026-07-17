import { describe, expect, it } from "vitest";
import {
  deriveBrowserCapabilities,
  deriveNexaAiCapabilities
} from "../src/integrations/integration-context.service.js";
import type { EntitlementStatus, UserStatus } from "@prisma/client";

const baseContext = {
  user: {
    id: "user_1",
    email: "user@example.com",
    username: "user",
    displayName: "User",
    avatarUrl: null,
    emailVerified: true,
    status: "active" as UserStatus,
    role: "user",
    profile: null,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  permissions: [],
  settings: { memoryEnabled: true, trainingOptIn: false },
  entitlements: [
    {
      id: "ent_1",
      product: { id: "nexa_ai", name: "Nexa AI", description: null, createdAt: new Date(), updatedAt: new Date() },
      plan: "plus",
      status: "active" as EntitlementStatus,
      limits: {},
      features: ["basic_chat", "memory", "page_summarization"],
      expiration: null,
      startsAt: new Date()
    },
    {
      id: "ent_2",
      product: { id: "nexa_browser", name: "Nexa Browser", description: null, createdAt: new Date(), updatedAt: new Date() },
      plan: "free",
      status: "active" as EntitlementStatus,
      limits: {},
      features: ["browser_login", "page_summarization"],
      expiration: null,
      startsAt: new Date()
    }
  ]
};

describe("integration capability derivation", () => {
  it("derives Nexa AI capabilities from entitlements and permissions", () => {
    expect(deriveNexaAiCapabilities(baseContext)).toMatchObject({
      canChat: true,
      canUseMemory: true,
      canUseBrowserSkills: true,
      canUseAutomations: false
    });
  });

  it("keeps basic browsing unauthenticated while enabling account features when entitled", () => {
    expect(deriveBrowserCapabilities(baseContext)).toMatchObject({
      basicBrowsingRequiresLogin: false,
      canUseAccountSync: true,
      canUseAiSidePanel: true,
      canUsePageSummaries: true
    });
  });
});
