import "dotenv/config";
import type { AdminRoleName } from "@prisma/client";
import { prisma } from "../src/config/database.js";
import { auditLog } from "../src/audit/audit.service.js";
import { createSupabaseAuthUser, deleteSupabaseAuthUser } from "../src/auth/supabase-auth.service.js";
import { permissionsForRole } from "../src/admin/services/admin-permission.service.js";
import { hashPassword } from "../src/security/password.js";
import { assignDefaultEntitlements } from "../src/products/entitlement.service.js";
import { initializeDefaultPermissions } from "../src/permissions/permission.service.js";

const adminAccounts: Array<{
  email: string;
  username: string;
  displayName: string;
  role: AdminRoleName;
}> = [
  {
    email: "admin.owner.test@trynexa-ai.com",
    username: "admin.owner.test",
    displayName: "Nexa Owner Admin",
    role: "owner"
  },
  {
    email: "admin.platform.test@trynexa-ai.com",
    username: "admin.platform.test",
    displayName: "Nexa Platform Admin",
    role: "admin"
  },
  {
    email: "admin.support.test@trynexa-ai.com",
    username: "admin.support.test",
    displayName: "Nexa Support Admin",
    role: "support"
  },
  {
    email: "admin.billing.test@trynexa-ai.com",
    username: "admin.billing.test",
    displayName: "Nexa Billing Admin",
    role: "billing"
  }
];

function adminTestPassword() {
  const password = process.env.ADMIN_TEST_PASSWORD?.trim();
  if (!password || password.length < 10) {
    throw new Error("Set ADMIN_TEST_PASSWORD to a local test password with at least 10 characters.");
  }

  return password;
}

async function ensureAdminAccount(account: (typeof adminAccounts)[number], password: string) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: account.email }, { username: account.username }] },
    select: { id: true, supabaseAuthUserId: true }
  });

  let supabaseAuthUserId = existing?.supabaseAuthUserId ?? null;
  if (!supabaseAuthUserId) {
    const supabaseUser = await createSupabaseAuthUser({
      email: account.email,
      username: account.username,
      displayName: account.displayName,
      password,
      emailConfirmed: true
    });
    supabaseAuthUserId = supabaseUser.id;
  }

  const passwordHash = await hashPassword(password);
  let user;
  try {
    user = await prisma.user.upsert({
      where: { email: account.email },
      update: {
        supabaseAuthUserId,
        username: account.username,
        displayName: account.displayName,
        passwordHash,
        emailVerified: true,
        status: "active",
        role: "admin",
        profile: { upsert: { create: {}, update: {} } }
      },
      create: {
        supabaseAuthUserId,
        email: account.email,
        username: account.username,
        displayName: account.displayName,
        passwordHash,
        emailVerified: true,
        status: "active",
        role: "admin",
        profile: { create: {} }
      }
    });
  } catch (error) {
    if (!existing?.supabaseAuthUserId && supabaseAuthUserId) {
      await deleteSupabaseAuthUser(supabaseAuthUserId).catch(() => undefined);
    }
    throw error;
  }

  await assignDefaultEntitlements(user.id);
  await initializeDefaultPermissions(user.id);
  await prisma.adminRole.updateMany({
    where: { userId: user.id, revokedAt: null, role: { not: account.role } },
    data: { revokedAt: new Date() }
  });

  const activeRole = await prisma.adminRole.findFirst({
    where: { userId: user.id, role: account.role, revokedAt: null }
  });

  if (activeRole) {
    await prisma.adminRole.update({
      where: { id: activeRole.id },
      data: { permissions: permissionsForRole(account.role) }
    });
  } else {
    await prisma.adminRole.create({
      data: {
        userId: user.id,
        role: account.role,
        permissions: permissionsForRole(account.role),
        createdBy: user.id
      }
    });
  }

  await auditLog({
    userId: user.id,
    action: "admin.test_account_seeded",
    resourceType: "admin_role",
    metadata: { role: account.role }
  });

  return { email: account.email, role: account.role };
}

async function main() {
  const password = adminTestPassword();
  const seeded = [];
  for (const account of adminAccounts) {
    seeded.push(await ensureAdminAccount(account, password));
  }

  console.log("Seeded Nexa admin test accounts:");
  for (const account of seeded) {
    console.log(`- ${account.email} (${account.role})`);
  }
}

await main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
