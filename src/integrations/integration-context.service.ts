import { prisma } from "../config/database.js";
import { getUserPermissions } from "../permissions/permission.service.js";
import { getUserEntitlements } from "../products/entitlement.service.js";
import { presentUser } from "../users/user.presenter.js";

export async function getIdentityContext(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { profile: true }
  });
  const [entitlements, permissions] = await Promise.all([
    getUserEntitlements(userId),
    getUserPermissions(userId)
  ]);
  const permissionMap = Object.fromEntries(permissions.map((permission) => [permission.scope, permission.value]));

  return {
    user: presentUser(user),
    entitlements,
    permissions,
    settings: {
      memoryEnabled: Boolean(permissionMap["ai.memory_enabled"]),
      trainingOptIn: Boolean(permissionMap["ai.training_opt_in"])
    }
  };
}

export function deriveNexaAiCapabilities(context: Awaited<ReturnType<typeof getIdentityContext>>) {
  const features = new Set(context.entitlements.flatMap((entitlement) => entitlement.features));
  const entitlementProducts = new Set(
    context.entitlements
      .filter((entitlement) => entitlement.status === "active")
      .map((entitlement) => entitlement.product.id)
  );

  return {
    canChat: entitlementProducts.has("nexa_ai"),
    canUseMemory: context.settings.memoryEnabled && features.has("memory"),
    canUseBrowserSkills: entitlementProducts.has("nexa_browser"),
    canUseAutomations: features.has("automations"),
    canUseVoice: features.has("voice"),
    canUseAgents: features.has("agents")
  };
}

export function deriveBrowserCapabilities(context: Awaited<ReturnType<typeof getIdentityContext>>) {
  const entitlementProducts = new Set(
    context.entitlements
      .filter((entitlement) => entitlement.status === "active")
      .map((entitlement) => entitlement.product.id)
  );
  const features = new Set(context.entitlements.flatMap((entitlement) => entitlement.features));

  return {
    basicBrowsingRequiresLogin: false,
    canUseAccountSync: entitlementProducts.has("nexa_browser"),
    canUseAiSidePanel: entitlementProducts.has("nexa_ai") && entitlementProducts.has("nexa_browser"),
    canUsePageSummaries: features.has("page_summarization"),
    canUseGuardian: features.has("browser_login")
  };
}
