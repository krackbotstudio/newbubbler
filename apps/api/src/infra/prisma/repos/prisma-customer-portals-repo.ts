import type {
  CustomerPortalCarouselImageRecord,
  CustomerPortalRecord,
  CustomerPortalsRepo,
  CustomerPortalWithImages,
} from '../../../application/ports';

type PrismaLike = any;

function toPortalRecord(row: any): CustomerPortalRecord {
  return {
    id: row.id,
    ownerUserId: row.ownerUserId ?? null,
    branchId: row.branchId,
    slug: row.slug,
    brandName: row.brandName,
    logoUrl: row.logoUrl ?? null,
    appIconUrl: row.appIconUrl ?? null,
    termsAndConditions: row.termsAndConditions ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toImageRecord(row: any): CustomerPortalCarouselImageRecord {
  return {
    id: row.id,
    portalId: row.portalId,
    position: row.position,
    imageUrl: row.imageUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toPortalWithImages(row: any): CustomerPortalWithImages {
  return {
    ...toPortalRecord(row),
    carouselImages: (row.carouselImages ?? []).map(toImageRecord),
  };
}

function toAccessKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export class PrismaCustomerPortalsRepo implements CustomerPortalsRepo {
  constructor(private readonly prisma: PrismaLike) {}

  async getByOwnerUserId(ownerUserId: string): Promise<CustomerPortalWithImages[]> {
    const rows = await this.prisma.customerPortal.findMany({
      where: { ownerUserId },
      include: { carouselImages: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toPortalWithImages);
  }

  async getByBranchId(branchId: string): Promise<CustomerPortalWithImages | null> {
    const row = await this.prisma.customerPortal.findUnique({
      where: { branchId },
      include: { carouselImages: { orderBy: { position: 'asc' } } },
    });
    return row ? toPortalWithImages(row) : null;
  }

  async getBySlug(slug: string): Promise<CustomerPortalWithImages | null> {
    const row = await this.prisma.customerPortal.findUnique({
      where: { slug },
      include: { carouselImages: { orderBy: { position: 'asc' } } },
    });
    return row ? toPortalWithImages(row) : null;
  }

  async getByAccessKey(key: string): Promise<CustomerPortalWithImages | null> {
    const normalized = toAccessKey(key);
    if (!normalized) return null;
    const bySlug = await this.getBySlug(normalized);
    if (bySlug) return bySlug;
    const rows = await this.prisma.customerPortal.findMany({
      where: { isActive: true },
      include: {
        carouselImages: { orderBy: { position: 'asc' } },
        branch: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
    const match = rows.find((row: any) => {
      const byBrandName = toAccessKey(row.brandName ?? '') === normalized;
      const byBranchName = toAccessKey(row.branch?.name ?? '') === normalized;
      return byBrandName || byBranchName;
    });
    return match ? toPortalWithImages(match) : null;
  }

  async create(input: {
    ownerUserId?: string | null;
    branchId: string;
    slug: string;
    brandName: string;
    termsAndConditions?: string | null;
  }): Promise<CustomerPortalWithImages> {
    const row = await this.prisma.customerPortal.create({
      data: {
        ownerUserId: input.ownerUserId ?? null,
        branchId: input.branchId,
        slug: input.slug,
        brandName: input.brandName,
        termsAndConditions: input.termsAndConditions ?? null,
      },
      include: { carouselImages: { orderBy: { position: 'asc' } } },
    });
    return toPortalWithImages(row);
  }

  async update(
    portalId: string,
    input: {
      slug?: string;
      brandName?: string;
      logoUrl?: string | null;
      appIconUrl?: string | null;
      termsAndConditions?: string | null;
      isActive?: boolean;
    },
  ): Promise<CustomerPortalWithImages> {
    const row = await this.prisma.customerPortal.update({
      where: { id: portalId },
      data: {
        ...(input.slug !== undefined && { slug: input.slug }),
        ...(input.brandName !== undefined && { brandName: input.brandName }),
        ...(input.logoUrl !== undefined && { logoUrl: input.logoUrl }),
        ...(input.appIconUrl !== undefined && { appIconUrl: input.appIconUrl }),
        ...(input.termsAndConditions !== undefined && {
          termsAndConditions: input.termsAndConditions,
        }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
      include: { carouselImages: { orderBy: { position: 'asc' } } },
    });
    return toPortalWithImages(row);
  }

  async setCarouselImage(
    portalId: string,
    position: number,
    imageUrl: string,
  ): Promise<CustomerPortalCarouselImageRecord> {
    const row = await this.prisma.customerPortalCarouselImage.upsert({
      where: { portalId_position: { portalId, position } },
      update: { imageUrl },
      create: { portalId, position, imageUrl },
    });
    return toImageRecord(row);
  }

  async listCarouselImages(portalId: string): Promise<CustomerPortalCarouselImageRecord[]> {
    const rows = await this.prisma.customerPortalCarouselImage.findMany({
      where: { portalId },
      orderBy: { position: 'asc' },
    });
    return rows.map(toImageRecord);
  }

  async isMember(portalId: string, customerUserId: string): Promise<boolean> {
    const row = await this.prisma.customerPortalMember.findUnique({
      where: { portalId_customerUserId: { portalId, customerUserId } },
      select: { id: true },
    });
    return !!row;
  }

  async addMember(portalId: string, customerUserId: string): Promise<void> {
    await this.prisma.customerPortalMember.upsert({
      where: { portalId_customerUserId: { portalId, customerUserId } },
      update: {},
      create: { portalId, customerUserId },
    });
  }

  async listMembers(portalId: string): Promise<Array<{ customerUserId: string; joinedAt: Date }>> {
    const rows = await this.prisma.customerPortalMember.findMany({
      where: { portalId },
      select: { customerUserId: true, joinedAt: true },
      orderBy: { joinedAt: 'asc' },
    });
    return rows;
  }
}

