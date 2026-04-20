export interface BranchRecord {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  email: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  footerNote: string | null;
  invoicePrefix: string | null;
  itemTagBrandName: string | null;
  termsAndConditions: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  logoUrl: string | null;
  upiId: string | null;
  upiPayeeName: string | null;
  upiLink: string | null;
  upiQrUrl: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BranchRepo {
  create(data: {
    name: string;
    address: string;
    phone?: string | null;
    email?: string | null;
    gstNumber?: string | null;
    panNumber?: string | null;
    footerNote?: string | null;
    invoicePrefix?: string | null;
    itemTagBrandName?: string | null;
    termsAndConditions?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    logoUrl?: string | null;
    upiId?: string | null;
    upiPayeeName?: string | null;
    upiLink?: string | null;
    upiQrUrl?: string | null;
    isDefault?: boolean;
  }): Promise<BranchRecord>;
  getById(id: string): Promise<BranchRecord | null>;
  listAll(): Promise<BranchRecord[]>;
  update(id: string, data: Partial<Omit<BranchRecord, 'id' | 'createdAt' | 'updatedAt'>>): Promise<BranchRecord>;
  /** Set isDefault to false for all branches except the given id (so only one can be main). */
  clearOtherDefaults(exceptBranchId: string): Promise<void>;
  setLogoUrl(id: string, url: string | null): Promise<void>;
  setUpiQrUrl(id: string, url: string | null): Promise<void>;
  delete(id: string): Promise<void>;
}
