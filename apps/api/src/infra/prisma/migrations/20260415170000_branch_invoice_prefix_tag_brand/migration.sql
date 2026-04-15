-- Optional branch invoice code segment and item-tag brand short name
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "invoicePrefix" TEXT;
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "itemTagBrandName" TEXT;
