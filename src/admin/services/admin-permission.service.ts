import type { AdminRoleName } from "@prisma/client";

export const adminPermissions = [
  "admin.users.view",
  "admin.users.update",
  "admin.users.disable",
  "admin.sessions.view",
  "admin.sessions.revoke",
  "admin.devices.view",
  "admin.entitlements.view",
  "admin.entitlements.update",
  "admin.permissions.view",
  "admin.permissions.reset",
  "admin.beta.view",
  "admin.beta.update",
  "admin.audit.view",
  "admin.audit.export",
  "admin.email.resend_verification",
  "admin.email.send_password_reset",
  "admin.api_keys.view",
  "admin.api_keys.revoke",
  "admin.system.view",
  "admin.admins.manage"
] as const;

export type AdminPermission = (typeof adminPermissions)[number];

const permissionByRole: Record<AdminRoleName, AdminPermission[]> = {
  owner: [...adminPermissions],
  admin: adminPermissions.filter((permission) => permission !== "admin.admins.manage"),
  support: [
    "admin.users.view",
    "admin.sessions.view",
    "admin.beta.view",
    "admin.email.resend_verification",
    "admin.email.send_password_reset"
  ],
  security: [
    "admin.users.view",
    "admin.sessions.view",
    "admin.sessions.revoke",
    "admin.devices.view",
    "admin.audit.view",
    "admin.system.view"
  ],
  billing: ["admin.users.view", "admin.entitlements.view", "admin.system.view"],
  developer: ["admin.users.view", "admin.audit.view", "admin.system.view"]
};

export function permissionsForRole(role: AdminRoleName, customPermissions: string[] = []) {
  return Array.from(new Set([...permissionByRole[role], ...customPermissions]));
}

export function roleHasPermission(role: AdminRoleName, permission: AdminPermission, customPermissions: string[] = []) {
  return permissionsForRole(role, customPermissions).includes(permission);
}

export function isAdminPermission(permission: string): permission is AdminPermission {
  return adminPermissions.includes(permission as AdminPermission);
}
