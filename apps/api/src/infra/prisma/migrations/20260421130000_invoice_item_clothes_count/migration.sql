-- Optional per-line piece count (no. of clothes); null means same as quantity for display.
ALTER TABLE "InvoiceItem" ADD COLUMN IF NOT EXISTS "clothesCount" DECIMAL(10,2);
