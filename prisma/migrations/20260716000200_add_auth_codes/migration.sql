CREATE TABLE "AuthCode" (
  "id" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "redirectUri" TEXT NOT NULL,
  "returnTo" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuthCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuthCode_codeHash_key" ON "AuthCode"("codeHash");
CREATE INDEX "AuthCode_userId_idx" ON "AuthCode"("userId");
CREATE INDEX "AuthCode_clientId_expiresAt_idx" ON "AuthCode"("clientId", "expiresAt");

ALTER TABLE "AuthCode"
  ADD CONSTRAINT "AuthCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
