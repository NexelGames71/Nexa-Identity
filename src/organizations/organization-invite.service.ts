import type { OrganizationRole } from "@prisma/client";
import { prisma } from "../config/database.js";
import { secureRandomToken, sha256 } from "../security/hash.js";
import { addDuration } from "../utils/time.js";

const INVITE_TTL = "7d";

export async function assertCanManageOrganization(userId: string, organizationId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: {
      userId,
      organizationId,
      status: "active",
      role: { in: ["owner", "admin"] }
    }
  });

  if (!membership) {
    throw new Error("Organization admin access is required.");
  }

  return membership;
}

export async function createOrganizationInvite(params: {
  organizationId: string;
  invitedByUserId: string;
  email: string;
  role: Exclude<OrganizationRole, "owner">;
}) {
  await assertCanManageOrganization(params.invitedByUserId, params.organizationId);

  const token = secureRandomToken(32);
  const invite = await prisma.organizationInvite.create({
    data: {
      organizationId: params.organizationId,
      email: params.email.toLowerCase(),
      role: params.role,
      tokenHash: sha256(token),
      invitedByUserId: params.invitedByUserId,
      expiresAt: addDuration(new Date(), INVITE_TTL)
    },
    include: { organization: true }
  });

  return { invite, token };
}

export async function acceptOrganizationInvite(params: { token: string; userId: string }) {
  const invite = await prisma.organizationInvite.findFirst({
    where: {
      tokenHash: sha256(params.token),
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() }
    }
  });

  if (!invite) {
    return null;
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: params.userId } });
  if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
    throw new Error("Invite email does not match the authenticated user.");
  }

  const [membership] = await prisma.$transaction([
    prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: invite.organizationId,
          userId: params.userId
        }
      },
      create: {
        organizationId: invite.organizationId,
        userId: params.userId,
        role: invite.role,
        status: "active"
      },
      update: {
        role: invite.role,
        status: "active"
      }
    }),
    prisma.organizationInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() }
    })
  ]);

  return membership;
}
