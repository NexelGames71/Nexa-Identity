import { prisma } from "../config/database.js";
import { secureRandomToken, sha256 } from "../security/hash.js";
import { addDuration } from "../utils/time.js";

const EMAIL_VERIFICATION_TTL = "24h";
const PASSWORD_RESET_TTL = "1h";

export async function createEmailVerificationToken(userId: string) {
  const token = secureRandomToken(32);
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: addDuration(new Date(), EMAIL_VERIFICATION_TTL)
    }
  });

  return token;
}

export async function consumeEmailVerificationToken(token: string) {
  const tokenHash = sha256(token);
  const record = await prisma.emailVerificationToken.findFirst({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } }
  });

  if (!record) {
    return null;
  }

  await prisma.$transaction([
    prisma.emailVerificationToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() }
    }),
    prisma.user.update({
      where: { id: record.userId },
      data: { emailVerified: true, status: "active" }
    })
  ]);

  return record.userId;
}

export async function createPasswordResetToken(userId: string) {
  const token = secureRandomToken(32);
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: sha256(token),
      expiresAt: addDuration(new Date(), PASSWORD_RESET_TTL)
    }
  });

  return token;
}

export async function consumePasswordResetToken(token: string) {
  const tokenHash = sha256(token);
  const record = await prisma.passwordResetToken.findFirst({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } }
  });

  if (!record) {
    return null;
  }

  await prisma.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() }
  });

  return record.userId;
}
