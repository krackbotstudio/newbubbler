import { type PrismaClient } from '@prisma/client';
import type { SegmentCategoryRepo, SegmentCategoryRecord } from '../../../application/ports';

type PrismaLike = Pick<PrismaClient, 'segmentCategory'>;

function toRecord(row: {
  id: string;
  branchId: string;
  code: string;
  label: string;
  isActive: boolean;
  createdAt: Date;
}): SegmentCategoryRecord {
  return {
    id: row.id,
    branchId: row.branchId,
    code: row.code,
    label: row.label,
    isActive: row.isActive,
    createdAt: row.createdAt,
  };
}

export class PrismaSegmentCategoryRepo implements SegmentCategoryRepo {
  constructor(private readonly prisma: PrismaLike) {}

  async create(
    branchId: string,
    code: string,
    label: string,
    isActive = true,
  ): Promise<SegmentCategoryRecord> {
    const row = await this.prisma.segmentCategory.create({
      data: { branchId, code, label, isActive },
    });
    return toRecord(row);
  }

  async getById(id: string): Promise<SegmentCategoryRecord | null> {
    const row = await this.prisma.segmentCategory.findUnique({
      where: { id },
    });
    return row ? toRecord(row) : null;
  }

  async getByBranchIdAndCode(branchId: string, code: string): Promise<SegmentCategoryRecord | null> {
    const row = await this.prisma.segmentCategory.findUnique({
      where: { branchId_code: { branchId, code } },
    });
    return row ? toRecord(row) : null;
  }

  async findFirstByCodeInBranches(code: string, branchIds: string[]): Promise<SegmentCategoryRecord | null> {
    const where =
      branchIds.length > 0
        ? { code, branchId: { in: branchIds } as const }
        : { code };
    const rows = await this.prisma.segmentCategory.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 1,
    });
    const row = rows[0];
    return row ? toRecord(row) : null;
  }

  async update(id: string, patch: { label?: string; isActive?: boolean }): Promise<SegmentCategoryRecord> {
    const row = await this.prisma.segmentCategory.update({
      where: { id },
      data: patch,
    });
    return toRecord(row);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.segmentCategory.delete({ where: { id } });
  }

  async listAll(): Promise<SegmentCategoryRecord[]> {
    const rows = await this.prisma.segmentCategory.findMany({
      orderBy: [{ branchId: 'asc' }, { code: 'asc' }],
    });
    return rows.map(toRecord);
  }

  async listByBranchId(branchId: string): Promise<SegmentCategoryRecord[]> {
    const rows = await this.prisma.segmentCategory.findMany({
      where: { branchId },
      orderBy: { code: 'asc' },
    });
    return rows.map(toRecord);
  }

  async listActive(): Promise<SegmentCategoryRecord[]> {
    const rows = await this.prisma.segmentCategory.findMany({
      where: { isActive: true },
      orderBy: [{ branchId: 'asc' }, { code: 'asc' }],
    });
    return rows.map(toRecord);
  }
}
