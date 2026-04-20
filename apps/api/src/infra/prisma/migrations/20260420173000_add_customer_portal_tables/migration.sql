CREATE TABLE IF NOT EXISTS "CustomerPortal" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "brandName" TEXT NOT NULL,
  "logoUrl" TEXT,
  "appIconUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "branchIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerPortal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CustomerPortalCarouselImage" (
  "id" TEXT NOT NULL,
  "portalId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerPortalCarouselImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CustomerPortalMember" (
  "id" TEXT NOT NULL,
  "portalId" TEXT NOT NULL,
  "customerUserId" TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerPortalMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerPortal_ownerUserId_key" ON "CustomerPortal"("ownerUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerPortal_slug_key" ON "CustomerPortal"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerPortalCarouselImage_portalId_position_key" ON "CustomerPortalCarouselImage"("portalId","position");
CREATE INDEX IF NOT EXISTS "CustomerPortalCarouselImage_portalId_idx" ON "CustomerPortalCarouselImage"("portalId");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerPortalMember_portalId_customerUserId_key" ON "CustomerPortalMember"("portalId","customerUserId");
CREATE INDEX IF NOT EXISTS "CustomerPortalMember_portalId_idx" ON "CustomerPortalMember"("portalId");
CREATE INDEX IF NOT EXISTS "CustomerPortalMember_customerUserId_idx" ON "CustomerPortalMember"("customerUserId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CustomerPortal_ownerUserId_fkey'
  ) THEN
    ALTER TABLE "CustomerPortal"
      ADD CONSTRAINT "CustomerPortal_ownerUserId_fkey"
      FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CustomerPortalCarouselImage_portalId_fkey'
  ) THEN
    ALTER TABLE "CustomerPortalCarouselImage"
      ADD CONSTRAINT "CustomerPortalCarouselImage_portalId_fkey"
      FOREIGN KEY ("portalId") REFERENCES "CustomerPortal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CustomerPortalMember_portalId_fkey'
  ) THEN
    ALTER TABLE "CustomerPortalMember"
      ADD CONSTRAINT "CustomerPortalMember_portalId_fkey"
      FOREIGN KEY ("portalId") REFERENCES "CustomerPortal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CustomerPortalMember_customerUserId_fkey'
  ) THEN
    ALTER TABLE "CustomerPortalMember"
      ADD CONSTRAINT "CustomerPortalMember_customerUserId_fkey"
      FOREIGN KEY ("customerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
