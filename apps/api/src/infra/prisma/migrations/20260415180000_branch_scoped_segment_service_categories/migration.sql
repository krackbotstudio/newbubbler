-- Branch-scoped service/segment categories (unique code per branch).

ALTER TABLE "ServiceCategory" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "SegmentCategory" ADD COLUMN IF NOT EXISTS "branchId" TEXT;

WITH pick AS (
  SELECT id FROM "Branch" ORDER BY "isDefault" DESC, "createdAt" ASC LIMIT 1
)
UPDATE "ServiceCategory" SET "branchId" = (SELECT id FROM pick) WHERE "branchId" IS NULL;

WITH pick AS (
  SELECT id FROM "Branch" ORDER BY "isDefault" DESC, "createdAt" ASC LIMIT 1
)
UPDATE "SegmentCategory" SET "branchId" = (SELECT id FROM pick) WHERE "branchId" IS NULL;

ALTER TABLE "ServiceCategory" ALTER COLUMN "branchId" SET NOT NULL;
ALTER TABLE "SegmentCategory" ALTER COLUMN "branchId" SET NOT NULL;

ALTER TABLE "ServiceCategory" DROP CONSTRAINT IF EXISTS "ServiceCategory_code_key";
ALTER TABLE "SegmentCategory" DROP CONSTRAINT IF EXISTS "SegmentCategory_code_key";

ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SegmentCategory" ADD CONSTRAINT "SegmentCategory_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ServiceCategory_branchId_code_key" ON "ServiceCategory"("branchId", "code");
CREATE UNIQUE INDEX "SegmentCategory_branchId_code_key" ON "SegmentCategory"("branchId", "code");

CREATE INDEX IF NOT EXISTS "ServiceCategory_branchId_idx" ON "ServiceCategory"("branchId");
CREATE INDEX IF NOT EXISTS "SegmentCategory_branchId_idx" ON "SegmentCategory"("branchId");
