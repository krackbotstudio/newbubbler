import { type PrismaClient } from '@prisma/client';
import type { ServiceCategoryRepo, ServiceCategoryRecord } from '../../../application/ports';

type PrismaLike = Pick<PrismaClient, 'serviceCategory'>;

function toRecord(row: {
  id: string;
  branchId: string;
  code: string;
  label: string;
  isActive: boolean;
  createdAt: Date;
}): ServiceCategoryRecord {
  return {
    id: row.id,
    branchId: row.branchId,
    code: row.code,
    label: row.label,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

export class PrismaServiceCategoryRepo implements ServiceCategoryRepo {
  constructor(private readonly prisma: PrismaLike) {}

  async create(
    branchId: string,
    code: string,
    label: string,
    isActive = true,
  ): Promise<ServiceCategoryRecord> {
    const row = await this.prisma.serviceCategory.create({
      data: { branchId, code, label, isActive },
    });
    return toRecord(row);
  }

  async getById(id: string): Promise<ServiceCategoryRecord | null> {
    const row = await this.prisma.serviceCategory.findUnique({
      where: { id },
    });
    return row ? toRecord(row) : null;
  }

  async getByBranchIdAndCode(branchId: string, code: string): Promise<ServiceCategoryRecord | null> {
    const row = await this.prisma.serviceCategory.findUnique({
      where: { branchId_code: { branchId, code } },
    });
    return row ? toRecord(row) : null;
  }

  async update(id: string, patch: { label?: string; isActive?: boolean }): Promise<ServiceCategoryRecord> {
    const row = await this.prisma.serviceCategory.update({
      where: { id },
      data: patch,
    });
    return toRecord(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.serviceCategory.delete({ where: { id } });
  }

  async listAll(): Promise<ServiceCategoryRecord[]> {
    const rows = await this.prisma.serviceCategory.findMany({
      orderBy: [{ branchId: 'asc' }, { code: 'asc' }],
    });
    return rows.map(toRecord);
  }

  async listByBranchId(branchId: string): Promise<ServiceCategoryRecord[]> {
    const rows = await this.prisma.serviceCategory.findMany({
      where: { branchId },
      orderBy: { code: 'asc' },
    });
    return rows.map(toRecord);
  }

  async listActive(): Promise<ServiceCategoryRecord[]> {
    const rows = await this.prisma.serviceCategory.findMany({
      where: { isActive: true },
      orderBy: [{ branchId: 'asc' }, { code: 'asc' }],
    });
    return rows.map(toRecord);
  }
}
