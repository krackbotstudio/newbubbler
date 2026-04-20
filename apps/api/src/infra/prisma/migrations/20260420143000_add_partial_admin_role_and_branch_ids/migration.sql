-- Add PARTIAL_ADMIN role to enum (idempotent if already present)
DO $$
BEGIN
  IF to_regtype('public."Role"') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM pg_enum
      WHERE enumlabel = 'PARTIAL_ADMIN'
        AND enumtypid = to_regtype('public."Role"')
    )
  THEN
    ALTER TYPE "Role" ADD VALUE 'PARTIAL_ADMIN';
  END IF;
END $$;

-- Add multi-branch access column for PARTIAL_ADMIN users
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "branchIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
