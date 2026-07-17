import { createEmailVerificationToken, createPasswordResetToken } from "../../auth/account-token.service.js";
import { prisma } from "../../config/database.js";
import { env } from "../../config/env.js";
import { sendBetaInvite, sendEmailVerification, sendPasswordReset } from "../../email/email.service.js";
import { secureRandomToken } from "../../security/hash.js";

type AdminEmailTemplate = "verify_email" | "password_reset" | "beta_invite";

function providerName() {
  return env.EMAIL_PROVIDER;
}

function adminEmailFrom() {
  return env.ADMIN_EMAIL_FROM;
}

export async function sendAdminAccountEmail(params: {
  adminUserId: string;
  targetUserId: string;
  template: AdminEmailTemplate;
}) {
  const user = await prisma.user.findUnique({
    where: { id: params.targetUserId },
    select: { id: true, email: true, displayName: true }
  });
  if (!user) {
    return null;
  }

  const event = await prisma.emailEvent.create({
    data: {
      targetUserId: user.id,
      adminUserId: params.adminUserId,
      template: params.template,
      provider: providerName(),
      status: "queued"
    }
  });

  try {
    let providerMessageId: string | undefined;
    if (params.template === "verify_email") {
      const token = await createEmailVerificationToken(user.id);
      providerMessageId = (await sendEmailVerification({ to: user.email, token, from: adminEmailFrom() })).providerMessageId;
    } else if (params.template === "password_reset") {
      const token = await createPasswordResetToken(user.id);
      providerMessageId = (await sendPasswordReset({ to: user.email, token, from: adminEmailFrom() })).providerMessageId;
    } else {
      const inviteCode = secureRandomToken(10);
      const betaAccess = await prisma.betaAccess.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          products: ["nexa_ai", "nexa_browser"],
          betaStatus: "invited",
          inviteCode,
          invitedAt: new Date(),
          notes: "Beta invite email requested by admin."
        },
        update: { betaStatus: "invited", invitedAt: new Date(), inviteCode }
      });
      providerMessageId = (
        await sendBetaInvite({
          to: user.email,
          from: adminEmailFrom(),
          displayName: user.displayName,
          inviteCode: betaAccess.inviteCode ?? undefined
        })
      ).providerMessageId;
    }

    return prisma.emailEvent.update({
      where: { id: event.id },
      data: { status: "sent", providerMessageId }
    });
  } catch (error) {
    return prisma.emailEvent.update({
      where: { id: event.id },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message : "Email delivery failed."
      }
    });
  }
}
