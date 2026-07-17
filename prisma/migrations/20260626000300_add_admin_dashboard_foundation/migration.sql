-- CreateEnum
CREATE TYPE "AdminRoleName" AS ENUM ('owner', 'admin', 'support', 'security', 'billing', 'developer');

-- CreateEnum
CREATE TYPE "BetaStatus" AS ENUM ('invited', 'active', 'paused', 'removed', 'completed');

-- CreateEnum
CREATE TYPE "BetaTesterType" AS ENUM ('internal', 'developer', 'student', 'founder', 'business', 'friend_family', 'public_beta');

-- CreateEnum
CREATE TYPE "EmailEventStatus" AS ENUM ('queued', 'sent', 'failed');

-- CreateTable
CREATE TABLE "AdminRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AdminRoleName" NOT NULL,
    "permissions" TEXT[],
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "AdminRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "role" "AdminRoleName" NOT NULL,
    "sessionTokenHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "mfaVerified" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetaAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "products" TEXT[],
    "betaStatus" "BetaStatus" NOT NULL DEFAULT 'invited',
    "inviteCode" TEXT,
    "invitedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3),
    "testerType" "BetaTesterType" NOT NULL DEFAULT 'public_beta',
    "notes" TEXT,
    "feedbackStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BetaAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportNote" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SupportNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "adminUserId" TEXT,
    "template" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerMessageId" TEXT,
    "status" "EmailEventStatus" NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminRole_userId_revokedAt_idx" ON "AdminRole"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "AdminRole_role_idx" ON "AdminRole"("role");

-- CreateIndex
CREATE INDEX "AdminSession_adminUserId_revokedAt_idx" ON "AdminSession"("adminUserId", "revokedAt");

-- CreateIndex
CREATE INDEX "AdminSession_sessionTokenHash_idx" ON "AdminSession"("sessionTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "BetaAccess_userId_key" ON "BetaAccess"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BetaAccess_inviteCode_key" ON "BetaAccess"("inviteCode");

-- CreateIndex
CREATE INDEX "BetaAccess_betaStatus_idx" ON "BetaAccess"("betaStatus");

-- CreateIndex
CREATE INDEX "SupportNote_targetUserId_createdAt_idx" ON "SupportNote"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailEvent_targetUserId_createdAt_idx" ON "EmailEvent"("targetUserId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailEvent_adminUserId_createdAt_idx" ON "EmailEvent"("adminUserId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailEvent_template_status_idx" ON "EmailEvent"("template", "status");

-- AddForeignKey
ALTER TABLE "AdminRole" ADD CONSTRAINT "AdminRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRole" ADD CONSTRAINT "AdminRole_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetaAccess" ADD CONSTRAINT "BetaAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportNote" ADD CONSTRAINT "SupportNote_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportNote" ADD CONSTRAINT "SupportNote_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
