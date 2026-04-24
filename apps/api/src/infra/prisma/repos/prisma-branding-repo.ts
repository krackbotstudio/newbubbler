import type { PrismaClient } from '@prisma/client';
import type {
  BrandingRepo,
  BrandingSettingsRecord,
  BrandingUpsertData,
} from '../../../application/ports';

const BRANDING_ID = 'branding-default';

type PrismaLike = Pick<PrismaClient, 'brandingSettings'>;

function toRecord(row: {
  id: string;
  businessName: string;
  logoUrl: string | null;
  address: string;
  phone: string;
  footerNote: string | null;
  panNumber: string | null;
  gstNumber: string | null;
  email: string | null;
  upiId: string | null;
  upiPayeeName: string | null;
  upiLink: string | null;
  upiQrUrl: string | null;
  termsAndConditions: string | null;
  privacyPolicy: string | null;
  welcomeBackgroundUrl: string | null;
  appIconUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}): BrandingSettingsRecord {
  return {
    id: row.id,
    businessName: row.businessName,
    logoUrl: row.logoUrl,
    address: row.address,
    phone: row.phone,
    footerNote: row.footerNote,
    panNumber: row.panNumber,
    gstNumber: row.gstNumber,
    email: row.email,
    upiId: row.upiId,
    upiPayeeName: row.upiPayeeName,
    upiLink: row.upiLink,
    upiQrUrl: row.upiQrUrl,
    termsAndConditions: row.termsAndConditions ?? null,
    privacyPolicy: row.privacyPolicy ?? null,
    welcomeBackgroundUrl: row.welcomeBackgroundUrl ?? null,
    appIconUrl: row.appIconUrl ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaBrandingRepo implements BrandingRepo {
  constructor(private readonly prisma: PrismaLike) {}

  async get(): Promise<BrandingSettingsRecord | null> {
    const row = await this.prisma.brandingSettings.findUnique({
      where: { id: BRANDING_ID },
    });
    return row ? toRecord(row) : null;
  }

  async upsert(data: BrandingUpsertData): Promise<BrandingSettingsRecord> {
    const row = await this.prisma.brandingSettings.upsert({
      where: { id: BRANDING_ID },
      create: {
        id: BRANDING_ID,
        businessName: data.businessName ?? 'Business',
        address: data.address ?? '',
        phone: data.phone ?? '',
        ...(data.footerNote !== undefined && { footerNote: data.footerNote }),
        ...(data.panNumber !== undefined && { panNumber: data.panNumber }),
        ...(data.gstNumber !== undefined && { gstNumber: data.gstNumber }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.upiId !== undefined && { upiId: data.upiId }),
        ...(data.upiPayeeName !== undefined && { upiPayeeName: data.upiPayeeName }),
        ...(data.upiLink !== undefined && { upiLink: data.upiLink }),
        ...(data.termsAndConditions !== undefined && { termsAndConditions: data.termsAndConditions }),
        ...(data.privacyPolicy !== undefined && { privacyPolicy: data.privacyPolicy }),
      },
      update: {
        ...(data.businessName !== undefined && { businessName: data.businessName }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.footerNote !== undefined && { footerNote: data.footerNote }),
        ...(data.panNumber !== undefined && { panNumber: data.panNumber }),
        ...(data.gstNumber !== undefined && { gstNumber: data.gstNumber }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.upiId !== undefined && { upiId: data.upiId }),
        ...(data.upiPayeeName !== undefined && { upiPayeeName: data.upiPayeeName }),
        ...(data.upiLink !== undefined && { upiLink: data.upiLink }),
        ...(data.termsAndConditions !== undefined && { termsAndConditions: data.termsAndConditions }),
        ...(data.privacyPolicy !== undefined && { privacyPolicy: data.privacyPolicy }),
      },
    });
    return toRecord(row);
  }

  async setLogoUrl(url: string | null): Promise<void> {
    await this.prisma.brandingSettings.upsert({
      where: { id: BRANDING_ID },
      create: {
        id: BRANDING_ID,
        businessName: 'Business',
        address: '',
        phone: '',
        logoUrl: url,
      },
      update: { logoUrl: url },
    });
  }

  async setUpiQrUrl(url: string | null): Promise<void> {
    await this.prisma.brandingSettings.upsert({
      where: { id: BRANDING_ID },
      create: {
        id: BRANDING_ID,
        businessName: 'Business',
        address: '',
        phone: '',
        upiQrUrl: url,
      },
      update: { upiQrUrl: url },
    });
  }

  async setWelcomeBackgroundUrl(url: string | null): Promise<void> {
    await this.prisma.brandingSettings.upsert({
      where: { id: BRANDING_ID },
      create: {
        id: BRANDING_ID,
        businessName: 'Business',
        address: '',
        phone: '',
        welcomeBackgroundUrl: url,
      },
      update: { welcomeBackgroundUrl: url },
    });
  }

  async setAppIconUrl(url: string | null): Promise<void> {
    await this.prisma.brandingSettings.upsert({
      where: { id: BRANDING_ID },
      create: {
        id: BRANDING_ID,
        businessName: 'Business',
        address: '',
        phone: '',
        appIconUrl: url,
      },
      update: { appIconUrl: url },
    });
  }
}
