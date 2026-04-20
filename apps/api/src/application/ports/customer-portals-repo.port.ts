export interface CustomerPortalCarouselImageRecord {
  id: string;
  portalId: string;
  position: number;
  imageUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerPortalRecord {
  id: string;
  ownerUserId: string | null;
  branchId: string;
  slug: string;
  brandName: string;
  logoUrl: string | null;
  appIconUrl: string | null;
  termsAndConditions: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerPortalWithImages extends CustomerPortalRecord {
  carouselImages: CustomerPortalCarouselImageRecord[];
}

export interface CustomerPortalsRepo {
  getByOwnerUserId(ownerUserId: string): Promise<CustomerPortalWithImages[]>;
  getByBranchId(branchId: string): Promise<CustomerPortalWithImages | null>;
  getBySlug(slug: string): Promise<CustomerPortalWithImages | null>;
  getByAccessKey(key: string): Promise<CustomerPortalWithImages | null>;
  create(input: {
    ownerUserId?: string | null;
    branchId: string;
    slug: string;
    brandName: string;
    termsAndConditions?: string | null;
  }): Promise<CustomerPortalWithImages>;
  update(
    portalId: string,
    input: {
      slug?: string;
      brandName?: string;
      logoUrl?: string | null;
      appIconUrl?: string | null;
      termsAndConditions?: string | null;
      isActive?: boolean;
    },
  ): Promise<CustomerPortalWithImages>;
  setCarouselImage(portalId: string, position: number, imageUrl: string): Promise<CustomerPortalCarouselImageRecord>;
  listCarouselImages(portalId: string): Promise<CustomerPortalCarouselImageRecord[]>;
  isMember(portalId: string, customerUserId: string): Promise<boolean>;
  addMember(portalId: string, customerUserId: string): Promise<void>;
  listMembers(portalId: string): Promise<Array<{ customerUserId: string; joinedAt: Date }>>;
}

