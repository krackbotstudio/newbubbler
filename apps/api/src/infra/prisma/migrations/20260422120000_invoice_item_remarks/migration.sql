-- Per-line free-text remarks (replaces “no. of clothes” in UI; optional).
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "remarks" TEXT;
