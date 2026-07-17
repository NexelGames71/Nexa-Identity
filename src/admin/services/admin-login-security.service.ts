import { prisma } from "../../config/database.js";

export const ADMIN_LOCK_AFTER_FAILURES = 8;
export const ADMIN_LOCK_DURATION_MS = 15 * 60 * 1000;

export function nextAdminLoginFailureState(failedLoginCount: number, now = new Date()) {
  const nextFailedLoginCount = failedLoginCount + 1;
  return {
    failedLoginCount: nextFailedLoginCount,
    lockedUntil:
      nextFailedLoginCount >= ADMIN_LOCK_AFTER_FAILURES
        ? new Date(now.getTime() + ADMIN_LOCK_DURATION_MS)
        : null
  };
}

export async function recordAdminLoginFailure(userId: string, failedLoginCount: number) {
  const state = nextAdminLoginFailureState(failedLoginCount);
  await prisma.user.update({
    where: { id: userId },
    data: state
  });
  return state;
}

export async function clearAdminLoginFailures(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginCount: 0, lockedUntil: null }
  });
}
