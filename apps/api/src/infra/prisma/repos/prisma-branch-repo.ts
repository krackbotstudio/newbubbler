import { type PrismaClient } from '@prisma/client';
import type { BranchRepo, BranchRecord } from '../../../application/ports';

type PrismaLike = Pick<PrismaClient, 'branch'>;

function toRecord(row: {
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
}): BranchRecord {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    phone: row.phone,
    email: row.email,
    gstNumber: row.gstNumber,
    panNumber: row.panNumber,
    footerNote: row.footerNote,
    invoicePrefix: row.invoicePrefix,
    itemTagBrandName: row.itemTagBrandName,
    termsAndConditions: row.termsAndConditions,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    logoUrl: row.logoUrl,
    upiId: row.upiId,
    upiPayeeName: row.upiPayeeName,
    upiLink: row.upiLink,
    upiQrUrl: row.upiQrUrl,
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaBranchRepo implements BranchRepo {
  constructor(private readonly prisma: PrismaLike) {}

  async create(data: Parameters<BranchRepo['create']>[0]): Promise<BranchRecord> {
    const row = await this.prisma.branch.create({
      data: {
        name: data.name,
        address: data.address,
        phone: data.phone ?? undefined,
        email: data.email ?? undefined,
        gstNumber: data.gstNumber ?? undefined,
        panNumber: data.panNumber ?? undefined,
        footerNote: data.footerNote ?? undefined,
        invoicePrefix: data.invoicePrefix ?? undefined,
        itemTagBrandName: data.itemTagBrandName ?? undefined,
        termsAndConditions: data.termsAndConditions ?? undefined,
        primaryColor: data.primaryColor ?? undefined,
        secondaryColor: data.secondaryColor ?? undefined,
        logoUrl: data.logoUrl ?? undefined,
        upiId: data.upiId ?? undefined,
        upiPayeeName: data.upiPayeeName ?? undefined,
        upiLink: data.upiLink ?? undefined,
        upiQrUrl: data.upiQrUrl ?? undefined,
        isDefault: data.isDefault ?? false,
      },
    });
    return toRecord(row);
  }

  async getById(id: string): Promise<BranchRecord | null> {
    const row = await this.prisma.branch.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async listAll(): Promise<BranchRecord[]> {
    const rows = await this.prisma.branch.findMany({ orderBy: { name: 'asc' } });
    return rows.map(toRecord);
  }

  async clearOtherDefaults(exceptBranchId: string): Promise<void> {
    await this.prisma.branch.updateMany({
      where: { id: { not: exceptBranchId } },
      data: { isDefault: false },
    });
  }

  async update(id: string, data: Parameters<BranchRepo['update']>[1]): Promise<BranchRecord> {
    const row = await this.prisma.branch.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.gstNumber !== undefined && { gstNumber: data.gstNumber }),
        ...(data.panNumber !== undefined && { panNumber: data.panNumber }),
        ...(data.footerNote !== undefined && { footerNote: data.footerNote }),
        ...(data.invoicePrefix !== undefined && { invoicePrefix: data.invoicePrefix }),
        ...(data.itemTagBrandName !== undefined && { itemTagBrandName: data.itemTagBrandName }),
        ...(data.termsAndConditions !== undefined && { termsAndConditions: data.termsAndConditions }),
        ...(data.primaryColor !== undefined && { primaryColor: data.primaryColor }),
        ...(data.secondaryColor !== undefined && { secondaryColor: data.secondaryColor }),
        ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
        ...(data.upiId !== undefined && { upiId: data.upiId }),
        ...(data.upiPayeeName !== undefined && { upiPayeeName: data.upiPayeeName }),
        ...(data.upiLink !== undefined && { upiLink: data.upiLink }),
        ...(data.upiQrUrl !== undefined && { upiQrUrl: data.upiQrUrl }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      },
    });
    return toRecord(row);
  }

  async setLogoUrl(id: string, url: string | null): Promise<void> {
    await this.prisma.branch.update({
      where: { id },
      data: { logoUrl: url },
    });
  }

  async setUpiQrUrl(id: string, url: string | null): Promise<void> {
    await this.prisma.branch.update({
      where: { id },
      data: { upiQrUrl: url },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.branch.delete({ where: { id } });
  }
}
