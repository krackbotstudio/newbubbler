-- Per-branch terms & conditions for invoices (in addition to logo, GST, PAN, etc.).
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "termsAndConditions" TEXT;
