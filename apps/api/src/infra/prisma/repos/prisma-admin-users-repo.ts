import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../../application/errors';
import type {
  AdminUsersRepo,
  AdminUserRecord,
  AdminUsersFilters,
  AdminUsersResult,
} from '../../../application/ports';

type PrismaLike = Pick<PrismaClient, 'user'>;

function toRecord(row: any): AdminUserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email!,
    role: row.role,
    branchId: row.branchId ?? null,
    branchIds: Array.isArray(row.branchIds) ? row.branchIds : [],
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class PrismaAdminUsersRepo implements AdminUsersRepo {
  constructor(private readonly prisma: PrismaLike) {}

  async listAdmin(filters: AdminUsersFilters): Promise<AdminUsersResult> {
    const { role, roles, active, search, branchId, branchIds, limit, cursor } = filters;

    // Use `not: CUSTOMER` so we do not send `AGENT` in SQL until Postgres enum includes it (avoids 22P02 before migrate).
    const where: any = {};
    if (Array.isArray(roles) && roles.length > 0) {
      where.role = { in: roles };
    } else {
      where.role = role ? role : { not: 'CUSTOMER' };
    }
    if (branchId) {
      where.branchId = branchId;
    } else if (Array.isArray(branchIds) && branchIds.length > 0) {
      where.branchId = { in: branchIds };
    }
    if (active !== undefined) {
      where.isActive = active;
    }
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' as const } },
        { name: { contains: search, mode: 'insensitive' as const } },
      ];
    }

    const take = limit ?? 20;
    const rows = await this.prisma.user.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
    });
    const page = rows.slice(0, take).map(toRecord);
    const nextCursor = rows.length > take ? rows[take].id : null;

    return {
      data: page,
      nextCursor,
    };
  }

  async createAdminUser(input: {
    name: string | null;
    email: string;
    role: string;
    branchId?: string | null;
    branchIds?: string[];
    isActive: boolean;
    passwordHash?: string | null;
  }): Promise<AdminUserRecord> {
    try {
      const row = await this.prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          role: input.role as any,
          branchId: input.branchId ?? undefined,
          branchIds: input.branchIds ?? [],
          isActive: input.isActive,
          passwordHash: input.passwordHash ?? undefined,
        } as any,
      });
      return toRecord(row as any);
    } catch (e: any) {
      if (e && typeof e === 'object' && 'code' in e && e.code === 'P2002') {
        throw new AppError('UNIQUE_CONSTRAINT', 'Email already exists', {
          email: input.email,
        });
      }
      throw e;
    }
  }

  async updateAdminUser(
    id: string,
    input: {
      name?: string | null;
      role?: string;
      branchId?: string | null;
      branchIds?: string[];
      isActive?: boolean;
    },
  ): Promise<AdminUserRecord> {
    const data: any = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.role !== undefined) data.role = input.role as any;
    if (input.branchId !== undefined) data.branchId = input.branchId ?? null;
    if (input.branchIds !== undefined) data.branchIds = { set: input.branchIds };
    if (input.isActive !== undefined) data.isActive = input.isActive;

    const row = await this.prisma.user.update({
      where: { id },
      data,
    });
    return toRecord(row as any);
  }

  async getById(id: string): Promise<AdminUserRecord | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
    });
    return row && row.role !== 'CUSTOMER' ? toRecord(row as any) : null;
  }

  async setPasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  async deleteUser(id: string): Promise<void> {
    await this.prisma.user.delete({
      where: { id },
    });
  }

  async countByBranchAndRole(branchId: string, role: string): Promise<number> {
    return this.prisma.user.count({
      where: { branchId, role: role as any },
    });
  }
}

