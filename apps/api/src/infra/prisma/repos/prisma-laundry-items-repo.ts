import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../../application/errors';
import type { LaundryItemsRepo, LaundryItemRecord } from '../../../application/ports';

type PrismaLike = Pick<PrismaClient, 'laundryItem' | 'orderItem'>;

function toRecord(row: {
  id: string;
  name: string;
  icon: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}): LaundryItemRecord {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    active: row.active,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaLaundryItemsRepo implements LaundryItemsRepo {
  constructor(private readonly prisma: PrismaLike) {}

  async create(name: string, active: boolean, icon?: string | null): Promise<LaundryItemRecord> {
    const row = await this.prisma.laundryItem.create({
      data: { name, active, icon: icon ?? null },
    });
    return toRecord(row);
  }

  async update(
    id: string,
    patch: { name?: string; active?: boolean; icon?: string | null },
  ): Promise<LaundryItemRecord> {
    const row = await this.prisma.laundryItem.update({
      where: { id },
      data: {
        ...patch,
        ...(patch.icon !== undefined && { icon: patch.icon }),
      },
    });
    return toRecord(row);
  }

  async getById(id: string): Promise<LaundryItemRecord | null> {
    const row = await this.prisma.laundryItem.findUnique({
      where: { id },
    });
    return row ? toRecord(row) : null;
  }

  async listAll(): Promise<LaundryItemRecord[]> {
    const rows = await this.prisma.laundryItem.findMany({
      orderBy: { name: 'asc' },
    });
    return rows.map(toRecord);
  }

  async listActive(): Promise<LaundryItemRecord[]> {
    const rows = await this.prisma.laundryItem.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    });
    return rows.map(toRecord);
  }

  async delete(id: string): Promise<void> {
    const orderRefs = await this.prisma.orderItem.count({
      where: { laundryItemId: id },
    });
    if (orderRefs > 0) {
      throw new AppError(
        'CATALOG_ITEM_IN_USE',
        'This catalog item cannot be deleted because it is referenced by existing orders.',
        { id },
      );
    }
    await this.prisma.laundryItem.delete({ where: { id } });
  }
}
