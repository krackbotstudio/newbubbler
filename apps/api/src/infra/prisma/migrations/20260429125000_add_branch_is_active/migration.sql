-- Add branch activation flag for admin control.
ALTER TABLE "Branch"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
