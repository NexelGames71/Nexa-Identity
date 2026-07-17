import { prisma } from "../config/database.js";

export async function createAccountDeletionRequest(params: {
  userId: string;
  reason?: string;
}) {
  const existing = await prisma.accountDeletionRequest.findFirst({
    where: { userId: params.userId, status: "pending" }
  });

  if (existing) {
    return existing;
  }

  return prisma.accountDeletionRequest.create({
    data: {
      userId: params.userId,
      requestedBy: params.userId,
      reason: params.reason
    }
  });
}

export async function reviewAccountDeletionRequest(params: {
  requestId: string;
  reviewedBy: string;
  status: "approved" | "rejected";
}) {
  return prisma.accountDeletionRequest.update({
    where: { id: params.requestId },
    data: {
      reviewedBy: params.reviewedBy,
      reviewedAt: new Date(),
      status: params.status
    }
  });
}
