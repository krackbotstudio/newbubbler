export interface Branch {
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
  createdAt: string;
  updatedAt: string;
}

export interface CreateBranchBody {
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
  upiId?: string | null;
  upiPayeeName?: string | null;
  upiLink?: string | null;
  isDefault?: boolean;
}

export interface UpdateBranchBody {
  name?: string;
  address?: string;
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
  upiId?: string | null;
  upiPayeeName?: string | null;
  upiLink?: string | null;
  isDefault?: boolean;
}

export interface BranchFieldUniquenessSlot {
  available: boolean;
  takenByBranchName?: string;
}

export interface BranchFieldUniquenessResponse {
  name: BranchFieldUniquenessSlot;
  invoicePrefix: BranchFieldUniquenessSlot;
  itemTagBrandName: BranchFieldUniquenessSlot;
}
