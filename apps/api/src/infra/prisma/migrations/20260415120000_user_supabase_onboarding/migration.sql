-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "supabaseAuthId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);

-- CreateIndex (multiple NULLs allowed under unique in PostgreSQL)
CREATE UNIQUE INDEX IF NOT EXISTS "User_supabaseAuthId_key" ON "User"("supabaseAuthId");

-- Existing staff already onboarded; new signups leave this NULL until they finish the wizard
UPDATE "User"
SET "onboardingCompletedAt" = NOW()
WHERE "onboardingCompletedAt" IS NULL
  AND role::text IN ('ADMIN', 'BILLING', 'OPS', 'AGENT');
