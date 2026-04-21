import { type PrismaClient } from '@prisma/client';
import type { LaundryItemBranchRepo } from '../../../application/ports';

type PrismaLike = Pick<PrismaClient, 'laundryItemBranch'>;

export class PrismaLaundryItemBranchRepo implements LaundryItemBranchRepo {
  constructor(private readonly prisma: PrismaLike) {}

  async getBranchIdsForItem(itemId: string): Promise<string[]> {
    const rows = await this.prisma.laundryItemBranch.findMany({
      where: { itemId },
      select: { branchId: true },
    });
    return rows.map((r) => r.branchId);
  }

  async getItemIdsAssignedToBranch(branchId: string): Promise<string[]> {
    const rows = await this.prisma.laundryItemBranch.findMany({
      where: { branchId },
      select: { itemId: true },
    });
    return rows.map((r) => r.itemId);
  }

  async getItemIdToBranchIdsMap(): Promise<Map<string, string[]>> {
    const rows = await this.prisma.laundryItemBranch.findMany({
      select: { itemId: true, branchId: true },
    });
    const map = new Map<string, string[]>();
    for (const r of rows) {
      const cur = map.get(r.itemId);
      if (cur) cur.push(r.branchId);
      else map.set(r.itemId, [r.branchId]);
    }
    return map;
  }

  async setBranchesForItem(itemId: string, branchIds: string[]): Promise<void> {
    await this.prisma.laundryItemBranch.deleteMany({ where: { itemId } });
    if (branchIds.length > 0) {
      await this.prisma.laundryItemBranch.createMany({
        data: branchIds.map((branchId) => ({ itemId, branchId })),
        skipDuplicates: true,
      });
    }
  }
}
