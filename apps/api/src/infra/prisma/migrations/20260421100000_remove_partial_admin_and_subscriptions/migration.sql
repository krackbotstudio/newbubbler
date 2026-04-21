-- Hard-remove PARTIAL_ADMIN and subscription flows (tables/cols/enums).
-- This migration is written to be resilient on partially-applied environments.
--
-- Do NOT wrap in BEGIN/COMMIT: Prisma Migrate already runs each migration in a transaction
-- on PostgreSQL. An explicit COMMIT ends that transaction early and causes errors like
-- "current transaction is aborted, commands ignored until end of transaction block".

-- Clean up leftover enum types from a crashed / non-atomic attempt (safe if absent).
DROP TYPE IF EXISTS "Role_new" CASCADE;
DROP TYPE IF EXISTS "OrderType_new" CASCADE;
DROP TYPE IF EXISTS "InvoiceOrderMode_new" CASCADE;
DROP TYPE IF EXISTS "InvoiceType_new" CASCADE;

-- 1) Data normalization so enum casts succeed
UPDATE "User"
SET "role" = 'ADMIN'
WHERE "role"::text = 'PARTIAL_ADMIN';

UPDATE "Order"
SET "orderType" = 'INDIVIDUAL'
WHERE "orderType"::text IN ('SUBSCRIPTION', 'BOTH');

UPDATE "Invoice"
SET "orderMode" = 'INDIVIDUAL'
WHERE "orderMode"::text IN ('SUBSCRIPTION_ONLY', 'BOTH');

-- Subscription-only rows (dynamic SQL so we never parse "subscriptionId" if column was already dropped).
DO $$
BEGIN
  DELETE FROM "Invoice" WHERE "type"::text = 'SUBSCRIPTION';
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Invoice'
      AND column_name = 'subscriptionId'
  ) THEN
    EXECUTE 'DELETE FROM "Invoice" WHERE "subscriptionId" IS NOT NULL';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Payment'
      AND column_name = 'subscriptionId'
  ) THEN
    EXECUTE 'DELETE FROM "Payment" WHERE "subscriptionId" IS NOT NULL';
  END IF;
END $$;

-- 2) Drop subscription columns from existing core tables
ALTER TABLE "User" DROP COLUMN IF EXISTS "branchIds";

ALTER TABLE "Order" DROP COLUMN IF EXISTS "subscriptionId" CASCADE;

ALTER TABLE "Payment" DROP COLUMN IF EXISTS "subscriptionId" CASCADE;

ALTER TABLE "Invoice"
  DROP COLUMN IF EXISTS "subscriptionId" CASCADE,
  DROP COLUMN IF EXISTS "subscriptionUtilized" CASCADE,
  DROP COLUMN IF EXISTS "subscriptionUsageKg" CASCADE,
  DROP COLUMN IF EXISTS "subscriptionUsageItems" CASCADE,
  DROP COLUMN IF EXISTS "subscriptionUsagesJson" CASCADE,
  DROP COLUMN IF EXISTS "newSubscriptionSnapshotJson" CASCADE,
  DROP COLUMN IF EXISTS "newSubscriptionFulfilledAt" CASCADE,
  DROP COLUMN IF EXISTS "subscriptionPurchaseSnapshotJson" CASCADE;

-- 3) Drop subscription tables
DROP TABLE IF EXISTS "SubscriptionUsage" CASCADE;
DROP TABLE IF EXISTS "Subscription" CASCADE;
DROP TABLE IF EXISTS "SubscriptionPlanBranch" CASCADE;
DROP TABLE IF EXISTS "SubscriptionPlan" CASCADE;

-- 4) Recreate enums without removed values
-- Role (drop default if any — PG cannot auto-cast default across enum replacement)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
    DROP TYPE IF EXISTS "Role_new" CASCADE;
    ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
    CREATE TYPE "Role_new" AS ENUM ('CUSTOMER', 'ADMIN', 'OPS', 'BILLING', 'AGENT');
    ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
    ALTER TYPE "Role" RENAME TO "Role_old";
    ALTER TYPE "Role_new" RENAME TO "Role";
    DROP TYPE "Role_old";
  END IF;
END $$;

-- OrderType (@default(INDIVIDUAL) on Order.orderType)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderType') THEN
    DROP TYPE IF EXISTS "OrderType_new" CASCADE;
    ALTER TABLE "Order" ALTER COLUMN "orderType" DROP DEFAULT;
    CREATE TYPE "OrderType_new" AS ENUM ('INDIVIDUAL');
    ALTER TABLE "Order" ALTER COLUMN "orderType" TYPE "OrderType_new" USING ("orderType"::text::"OrderType_new");
    ALTER TYPE "OrderType" RENAME TO "OrderType_old";
    ALTER TYPE "OrderType_new" RENAME TO "OrderType";
    DROP TYPE "OrderType_old";
    ALTER TABLE "Order" ALTER COLUMN "orderType" SET DEFAULT 'INDIVIDUAL'::"OrderType";
  END IF;
END $$;

-- InvoiceOrderMode (@default(INDIVIDUAL) on Invoice.orderMode)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceOrderMode') THEN
    DROP TYPE IF EXISTS "InvoiceOrderMode_new" CASCADE;
    ALTER TABLE "Invoice" ALTER COLUMN "orderMode" DROP DEFAULT;
    CREATE TYPE "InvoiceOrderMode_new" AS ENUM ('INDIVIDUAL');
    ALTER TABLE "Invoice" ALTER COLUMN "orderMode" TYPE "InvoiceOrderMode_new" USING ("orderMode"::text::"InvoiceOrderMode_new");
    ALTER TYPE "InvoiceOrderMode" RENAME TO "InvoiceOrderMode_old";
    ALTER TYPE "InvoiceOrderMode_new" RENAME TO "InvoiceOrderMode";
    DROP TYPE "InvoiceOrderMode_old";
    ALTER TABLE "Invoice" ALTER COLUMN "orderMode" SET DEFAULT 'INDIVIDUAL'::"InvoiceOrderMode";
  END IF;
END $$;

-- InvoiceType (drop default if present — no Prisma @default on type)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InvoiceType') THEN
    DROP TYPE IF EXISTS "InvoiceType_new" CASCADE;
    ALTER TABLE "Invoice" ALTER COLUMN "type" DROP DEFAULT;
    CREATE TYPE "InvoiceType_new" AS ENUM ('ACKNOWLEDGEMENT', 'FINAL');
    ALTER TABLE "Invoice" ALTER COLUMN "type" TYPE "InvoiceType_new" USING ("type"::text::"InvoiceType_new");
    ALTER TYPE "InvoiceType" RENAME TO "InvoiceType_old";
    ALTER TYPE "InvoiceType_new" RENAME TO "InvoiceType";
    DROP TYPE "InvoiceType_old";
  END IF;
END $$;

-- Clean up now-unused enums from subscriptions (safe even if already gone)
DROP TYPE IF EXISTS "SubscriptionVariant";
DROP TYPE IF EXISTS "RedemptionMode";
