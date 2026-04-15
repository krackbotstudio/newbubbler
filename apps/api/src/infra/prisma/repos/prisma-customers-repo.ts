import type { PrismaClient } from '@prisma/client';
import { Prisma, Role } from '@prisma/client';
import type { CustomersRepo, CustomerRecord, UpdateCustomerPatch, ListCustomersResult, CreateCustomerInput } from '../../../application/ports';

type PrismaLike = Pick<PrismaClient, 'user'>;

function toRecord(row: {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  notes: string | null;
  expoPushToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CustomerRecord {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    role: row.role,
    notes: row.notes,
    expoPushToken: row.expoPushToken ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaCustomersRepo implements CustomersRepo {
  constructor(private readonly prisma: PrismaLike) {}

  /**
   * Phone substring search for admin customer lookup (e.g. branch head).
   * Intentionally does **not** require prior orders in a branch — same idea as walk-in `getByPhone`,
   * so existing customers show up even before their first branch order.
   * (`branchId` is kept for API compatibility; list() still scopes bulk lists by branch when needed.)
   */
  async findByPhone(phoneLike: string, _branchId?: string | null): Promise<CustomerRecord[]> {
    const rows = await this.prisma.user.findMany({
      where: {
        role: 'CUSTOMER',
        phone: { contains: phoneLike, mode: 'insensitive' as const },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toRecord);
  }

  async getByPhone(phone: string): Promise<CustomerRecord | null> {
    const row = await this.prisma.user.findFirst({
      where: { role: 'CUSTOMER', phone: phone.trim() },
    });
    return row ? toRecord(row) : null;
  }

  async getById(userId: string): Promise<CustomerRecord | null> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    return row ? toRecord(row) : null;
  }

  async create(input: CreateCustomerInput): Promise<CustomerRecord> {
    const phone = input.phone.trim();
    if (!phone) throw new Error('Phone is required');
    const row = await this.prisma.user.create({
      data: {
        role: 'CUSTOMER',
        phone,
        name: input.name?.trim() || null,
        email: input.email?.trim() || null,
      },
    });
    return toRecord(row);
  }

  async count(): Promise<number> {
    return this.prisma.user.count({ where: { role: 'CUSTOMER' } });
  }

  async countWithOrdersInBranch(branchId: string): Promise<number> {
    const db = this.prisma as unknown as PrismaClient;
    const areas = await db.serviceArea.findMany({
      where: { branchId, active: true },
      select: { pincode: true },
    });
    const pincodes = [...new Set(areas.map((a) => a.pincode))];
    const orderMatch: Prisma.OrderWhereInput =
      pincodes.length > 0
        ? {
            OR: [{ branchId }, { branchId: null, pincode: { in: pincodes } }],
          }
        : { branchId };
    return db.user.count({
      where: {
        role: Role.CUSTOMER,
        orders: { some: orderMatch },
      },
    });
  }

  async list(limit: number, cursor?: string | null, search?: string | null, branchId?: string | null): Promise<ListCustomersResult> {
    const db = this.prisma as unknown as PrismaClient;
    let ordersInBranch: Prisma.OrderListRelationFilter | undefined;
    if (branchId != null && branchId !== '') {
      const areas = await db.serviceArea.findMany({
        where: { branchId, active: true },
        select: { pincode: true },
      });
      const pincodes = [...new Set(areas.map((a) => a.pincode))];
      const orderMatch: Prisma.OrderWhereInput =
        pincodes.length > 0
          ? {
              OR: [{ branchId }, { branchId: null, pincode: { in: pincodes } }],
            }
          : { branchId };
      ordersInBranch = { some: orderMatch };
    }
    const where: Prisma.UserWhereInput = {
      role: Role.CUSTOMER,
      ...(ordersInBranch ? { orders: ordersInBranch } : {}),
      ...(search && search.trim()
        ? {
            OR: [
              { phone: { contains: search.trim(), mode: 'insensitive' as const } },
              { name: { contains: search.trim(), mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const take = limit + 1;
    const rows = await this.prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
    });
    const data = rows.slice(0, limit).map(toRecord);
    const nextCursor = rows.length > limit ? rows[limit - 1].id : null;
    return { data, nextCursor };
  }

  async update(userId: string, patch: UpdateCustomerPatch): Promise<CustomerRecord> {
    const row = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.email !== undefined && { email: patch.email }),
        ...(patch.notes !== undefined && { notes: patch.notes }),
        ...(patch.expoPushToken !== undefined && { expoPushToken: patch.expoPushToken }),
      },
    });
    return toRecord(row);
  }
}
