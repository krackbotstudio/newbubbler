import { AppError } from '../errors';
import type { BrandingRepo, BrandingSettingsRecord } from '../ports';

export interface GetBrandingDeps {
  brandingRepo: BrandingRepo;
}

export async function getBranding(deps: GetBrandingDeps): Promise<BrandingSettingsRecord> {
  const branding = await deps.brandingRepo.get();
  if (branding) return branding;

  // If no branding exists, return a default record to avoid 404s blocking the admin UI.
  return {
    id: 'branding-default',
    businessName: 'Business',
    address: '',
    phone: '',
    logoUrl: null,
    footerNote: null,
    panNumber: null,
    gstNumber: null,
    email: null,
    upiId: null,
    upiPayeeName: null,
    upiLink: null,
    upiQrUrl: null,
    termsAndConditions: null,
    privacyPolicy: null,
    welcomeBackgroundUrl: null,
    appIconUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
