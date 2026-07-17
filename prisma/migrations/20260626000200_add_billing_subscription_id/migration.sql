-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "billingSubscriptionId" TEXT;

-- CreateIndex
CREATE INDEX "Subscription_billingProvider_billingSubscriptionId_idx" ON "Subscription"("billingProvider", "billingSubscriptionId");
