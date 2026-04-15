import type { PrismaClient } from '@prisma/client';
import { AppError } from '../../../application/errors';
import type { HolidayRecord, HolidaysRepo, UpdateHolidayPatch } from '../../../application/ports';
import { toIndiaDateKey, indiaDayRange } from '../../../application/time/india-date';

type PrismaLike = Pick<PrismaClient, 'holiday'>;

export class PrismaHolidaysRepo implements HolidaysRepo {
  constructor(private readonly prisma: PrismaLike) {}

  async isHoliday(date: Date, branchId?: string | null): Promise<boolean> {
    const key = toIndiaDateKey(date);
    const { start } = indiaDayRange(key);
    const where: { date: Date; OR?: { branchId: string | null }[] } = { date: start };
    if (branchId !== undefined && branchId !== null) {
      where.OR = [{ branchId: null }, { branchId }];
    }
    const row = await this.prisma.holiday.findFirst({
      where,
    });
    return !!row;
  }

  async getById(id: string): Promise<HolidayRecord | null> {
    const row = await this.prisma.holiday.findUnique({ where: { id } });
    return row
      ? { id: row.id, date: row.date, label: row.label ?? null, branchId: row.branchId }
      : null;
  }

  async list(from: Date, to: Date, branchId?: string | null): Promise<HolidayRecord[]> {
    const fromKey = toIndiaDateKey(from);
    const toKey = toIndiaDateKey(to);
    const { start: fromStart } = indiaDayRange(fromKey);
    const { start: toStart } = indiaDayRange(toKey);
    const dateRange = { gte: fromStart, lte: toStart };
    const where: { date: { gte: Date; lte: Date }; branchId?: null; OR?: { branchId: string | null }[] } = {
      date: dateRange,
    };
    if (branchId !== undefined && branchId !== null) {
      where.OR = [{ branchId: null }, { branchId }];
    } else {
      where.branchId = null;
    }
    const rows = await this.prisma.holiday.findMany({
      where,
      orderBy: { date: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      label: r.label ?? null,
      branchId: r.branchId,
    }));
  }

  async add(date: Date, label?: string | null, branchId?: string | null): Promise<HolidayRecord> {
    const key = toIndiaDateKey(date);
    const { start } = indiaDayRange(key);
    const bid = branchId ?? null;
    try {
      const row = await this.prisma.holiday.create({
        data: { date: start, label: label ?? undefined, branchId: bid },
      });
      return { id: row.id, date: row.date, label: row.label ?? null, branchId: row.branchId };
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002') {
        throw new AppError(
          'UNIQUE_CONSTRAINT',
          'This date is already added as a holiday for this scope.',
          { date: key },
        );
      }
      throw e;
    }
  }

  async update(id: string, patch: UpdateHolidayPatch): Promise<HolidayRecord> {
    const data: { date?: Date; label?: string | null; branchId?: string | null } = {};
    if (patch.date !== undefined) {
      const key = toIndiaDateKey(patch.date);
      const { start } = indiaDayRange(key);
      data.date = start;
    }
    if (patch.label !== undefined) data.label = patch.label;
    if (patch.branchId !== undefined) data.branchId = patch.branchId;
    if (Object.keys(data).length === 0) {
      const row = await this.prisma.holiday.findUnique({ where: { id } });
      if (!row) throw new AppError('NOT_FOUND', 'Holiday not found', { id });
      return { id: row.id, date: row.date, label: row.label ?? null, branchId: row.branchId };
    }
    try {
      const row = await this.prisma.holiday.update({
        where: { id },
        data,
      });
      return { id: row.id, date: row.date, label: row.label ?? null, branchId: row.branchId };
    } catch (e: unknown) {
      if (e && typeof e === 'object' && 'code' in e && (e as { code: string }).code === 'P2002') {
        throw new AppError(
          'UNIQUE_CONSTRAINT',
          'This date is already added as a holiday for this scope.',
          { id },
        );
      }
      throw e;
    }
  }

  async remove(id: string): Promise<void> {
    await this.prisma.holiday.delete({ where: { id } });
  }
}
