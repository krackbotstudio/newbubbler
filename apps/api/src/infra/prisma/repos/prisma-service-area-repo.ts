import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { AppError } from '../../../application/errors';
import type { ServiceAreaRepo, ServiceAreaRecord, UpdateServiceAreaPatch } from '../../../application/ports';

type PrismaLike = Pick<PrismaClient, 'serviceArea'>;

function toRecord(row: { id: string; pincode: string; branchId: string; active: boolean; createdAt: Date; updatedAt: Date }): ServiceAreaRecord {
  return {
    id: row.id,
    pincode: row.pincode,
    branchId: row.branchId,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaServiceAreaRepo implements ServiceAreaRepo {
  constructor(private readonly prisma: PrismaLike) {}

  async isServiceable(pincode: string): Promise<boolean> {
    const row = await this.prisma.serviceArea.findFirst({
      where: { pincode, active: true },
    });
    return !!row;
  }

  async listAll(): Promise<ServiceAreaRecord[]> {
    const rows = await this.prisma.serviceArea.findMany({
      orderBy: [{ pincode: 'asc' }, { branchId: 'asc' }],
    });
    return rows.map(toRecord);
  }

  async listByBranchId(branchId: string): Promise<ServiceAreaRecord[]> {
    const rows = await this.prisma.serviceArea.findMany({
      where: { branchId },
      orderBy: { pincode: 'asc' },
    });
    return rows.map(toRecord);
  }

  async listActiveByPincode(pincode: string): Promise<ServiceAreaRecord[]> {
    const rows = await this.prisma.serviceArea.findMany({
      where: { pincode, active: true },
      include: { branch: { select: { isDefault: true } } },
    });
    const sorted = [...rows].sort((a, b) => Number(b.branch.isDefault) - Number(a.branch.isDefault));
    return sorted.map(toRecord);
  }

  async getByPincode(pincode: string): Promise<ServiceAreaRecord | null> {
    const sorted = await this.listActiveByPincode(pincode);
    return sorted[0] ?? null;
  }

  async getById(id: string): Promise<ServiceAreaRecord | null> {
    const row = await this.prisma.serviceArea.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async upsert(pincode: string, branchId: string, active: boolean): Promise<ServiceAreaRecord> {
    const row = await this.prisma.serviceArea.upsert({
      where: { pincode_branchId: { pincode, branchId } },
      create: { pincode, branchId, active },
      update: { active },
    });
    return toRecord(row);
  }

  async setActive(id: string, active: boolean): Promise<ServiceAreaRecord> {
    const row = await this.prisma.serviceArea.update({
      where: { id },
      data: { active },
    });
    return toRecord(row);
  }

  async update(id: string, patch: UpdateServiceAreaPatch): Promise<ServiceAreaRecord> {
    const data: { branchId?: string; active?: boolean } = {};
    if (patch.branchId !== undefined) data.branchId = patch.branchId;
    if (patch.active !== undefined) data.active = patch.active;
    if (Object.keys(data).length === 0) {
      const row = await this.prisma.serviceArea.findUnique({ where: { id } });
      if (!row) throw new AppError('NOT_FOUND', 'Service area not found', { id });
      return toRecord(row);
    }
    try {
      const row = await this.prisma.serviceArea.update({
        where: { id },
        data,
      });
      return toRecord(row);
    } catch (e: unknown) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new AppError(
          'PINCODE_ALREADY_IN_OTHER_BRANCH',
          'That branch already has this pincode.',
          { id },
        );
      }
      throw e;
    }
  }

  async remove(id: string): Promise<void> {
    await this.prisma.serviceArea.delete({ where: { id } });
  }
}
