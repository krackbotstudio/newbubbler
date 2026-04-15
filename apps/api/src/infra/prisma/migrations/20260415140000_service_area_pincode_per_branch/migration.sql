-- Same pincode may be served by multiple branches; uniqueness is per (pincode, branchId).
DROP INDEX IF EXISTS "ServiceArea_pincode_key";
CREATE UNIQUE INDEX "ServiceArea_pincode_branchId_key" ON "ServiceArea"("pincode", "branchId");
