import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { prisma } from "../src/config/database.js";
import { env, isProduction } from "../src/config/env.js";
import { auditLog } from "../src/audit/audit.service.js";
import { hashPassword } from "../src/security/password.js";
import { assignAdminRole, ownerExists } from "../src/admin/services/admin-role.service.js";

function requireBootstrapAllowed(token?: string) {
  if (!env.ALLOW_OWNER_BOOTSTRAP) {
    throw new Error("Owner bootstrap is disabled. Set ALLOW_OWNER_BOOTSTRAP=true temporarily.");
  }

  if (isProduction && (!env.OWNER_BOOTSTRAP_TOKEN || token !== env.OWNER_BOOTSTRAP_TOKEN)) {
    throw new Error("OWNER_BOOTSTRAP_TOKEN is required in production.");
  }
}

async function main() {
  const tokenArg = process.argv.find((arg) => arg.startsWith("--token="))?.slice("--token=".length);
  requireBootstrapAllowed(tokenArg);

  if (await ownerExists()) {
    throw new Error("An owner admin already exists. Refusing to create another bootstrap owner.");
  }

  const rl = createInterface({ input, output });
  try {
    const email = (await rl.question("Owner email: ")).trim().toLowerCase();
    const username = (await rl.question("Owner username: ")).trim();
    const displayName = (await rl.question("Owner display name: ")).trim();
    const password = await rl.question("Owner password: ");

    if (!email || !username || !displayName || password.length < 10) {
      throw new Error("Email, username, display name, and a password of at least 10 characters are required.");
    }

    const user = await prisma.user.create({
      data: {
        email,
        username,
        displayName,
        passwordHash: await hashPassword(password),
        emailVerified: true,
        status: "active",
        role: "admin",
        profile: { create: {} }
      }
    });
    const adminRole = await assignAdminRole({ userId: user.id, role: "owner", createdBy: user.id });
    await auditLog({
      userId: user.id,
      action: "admin.owner_bootstrapped",
      resourceType: "admin_role",
      resourceId: adminRole.id
    });

    console.log(`Owner admin created for ${email}. Disable ALLOW_OWNER_BOOTSTRAP now.`);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

await main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
