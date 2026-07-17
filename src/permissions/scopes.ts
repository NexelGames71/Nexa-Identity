export const permissionScopes = [
  "browser.read_current_page",
  "browser.read_all_tabs",
  "browser.open_tabs",
  "browser.close_tabs",
  "browser.navigate",
  "browser.read_history",
  "browser.read_bookmarks",
  "browser.manage_downloads",
  "ai.memory_enabled",
  "ai.training_opt_in",
  "email.read",
  "email.draft",
  "email.send",
  "cloud.storage.read",
  "cloud.storage.write",
  "cloud.database.read",
  "cloud.database.write",
  "guardian.scan_links",
  "guardian.block_risky_sites",
  "guardian.private_route_recommendations"
] as const;

export function isKnownPermissionScope(scope: string): boolean {
  return permissionScopes.includes(scope as (typeof permissionScopes)[number]);
}
