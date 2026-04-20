-- Convert customer portals to branch-scoped portals (one portal per branch).
ALTER TABLE "CustomerPortal"
  ADD COLUMN IF NOT EXISTS "branchId" TEXT,
  ADD COLUMN IF NOT EXISTS "termsAndConditions" TEXT;

UPDATE "CustomerPortal"
SET "branchId" = COALESCE("branchId", "branchIds"[1])
WHERE "branchId" IS NULL;

DELETE FROM "CustomerPortal"
WHERE "branchId" IS NULL;

DELETE FROM "CustomerPortal" p
USING "CustomerPortal" newer
WHERE p."branchId" = newer."branchId"
  AND p."id" <> newer."id"
  AND p."createdAt" < newer."createdAt";

ALTER TABLE "CustomerPortal"
  ALTER COLUMN "ownerUserId" DROP NOT NULL;

ALTER TABLE "CustomerPortal"
  ALTER COLUMN "branchId" SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'CustomerPortal'
      AND constraint_name = 'CustomerPortal_ownerUserId_fkey'
  ) THEN
    ALTER TABLE "CustomerPortal" DROP CONSTRAINT "CustomerPortal_ownerUserId_fkey";
  END IF;
END $$;

ALTER TABLE "CustomerPortal"
  ADD CONSTRAINT "CustomerPortal_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'CustomerPortal_ownerUserId_key'
  ) THEN
    EXECUTE 'DROP INDEX "CustomerPortal_ownerUserId_key"';
  END IF;
END $$;

ALTER TABLE "CustomerPortal"
  ADD CONSTRAINT "CustomerPortal_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerPortal_branchId_key" ON "CustomerPortal"("branchId");

ALTER TABLE "CustomerPortal"
  DROP COLUMN IF EXISTS "branchIds";
