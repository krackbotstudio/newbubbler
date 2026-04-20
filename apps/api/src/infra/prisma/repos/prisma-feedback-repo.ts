import { Prisma, type PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AppError } from '../../../application/errors';
import type {
  FeedbackRepo,
  FeedbackRecord,
  CreateFeedbackInput,
  AdminFeedbackFilters,
  AdminFeedbackResult,
  AdminFeedbackRatingStatsFilters,
  AdminFeedbackRatingStatsResult,
} from '../../../application/ports';
import type { FeedbackStatus } from '@shared/enums';

const PgUniqueViolation = 'P2002';

type PrismaLike = Pick<PrismaClient, 'feedback'>;

const FEEDBACK_SELECT_NO_TAGS = {
  id: true,
  userId: true,
  orderId: true,
  type: true,
  rating: true,
  message: true,
  status: true,
  adminNotes: true,
  createdAt: true,
  updatedAt: true,
} as const;

function escapePgArrayElement(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * Legacy DBs sometimes store Feedback.tags as TEXT holding a Postgres array literal,
 * e.g. "{area_request}" instead of a real TEXT[] column. Prisma expects String[].
 */
function formatTagsAsLegacyTextColumnValue(tags?: string[] | null): string {
  const list = tags?.length ? tags : [];
  if (list.length === 0) return '{}';
  return `{${list.map((t) => `"${escapePgArrayElement(t)}"`).join(',')}}`;
}

function toRecord(row: {
  id: string;
  userId: string | null;
  orderId: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  type: string;
  rating: number | null;
  tags?: string[] | string | null;
  message: string | null;
  status: string;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): FeedbackRecord {
  const normalizedTags = Array.isArray(row.tags)
    ? row.tags
    : typeof row.tags === 'string'
      ? [row.tags]
      : [];
  return {
    id: row.id,
    userId: row.userId,
    orderId: row.orderId,
    customerName: row.customerName ?? null,
    customerPhone: row.customerPhone ?? null,
    type: row.type as FeedbackRecord['type'],
    rating: row.rating,
    tags: normalizedTags,
    message: row.message,
    status: row.status as FeedbackRecord['status'],
    adminNotes: row.adminNotes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function isPrismaUniqueConstraint(e: unknown): boolean {
  if (e && typeof e === 'object' && 'code' in e) {
    return (e as { code: string }).code === PgUniqueViolation;
  }
  return false;
}

export class PrismaFeedbackRepo implements FeedbackRepo {
  constructor(private readonly prisma: PrismaLike) {}

  private get prismaClient(): PrismaClient {
    return this.prisma as unknown as PrismaClient;
  }

  private buildAdminWhere(
    filters: AdminFeedbackFilters | AdminFeedbackRatingStatsFilters,
  ): Record<string, unknown> {
    const andFilters: Array<Record<string, unknown>> = [];

    if (filters.type != null) {
      andFilters.push({ type: filters.type });
      if (filters.type === 'ORDER') {
        // ORDER feedback should be shown only when it still points to an existing order.
        // With FK ON DELETE SET NULL, deleted orders become orderId=null.
        andFilters.push({ orderId: { not: null } });
      }
    } else {
      // When type is not specified, include GENERAL feedback and valid ORDER feedback only.
      andFilters.push({
        OR: [
          { type: { not: 'ORDER' } },
          { AND: [{ type: 'ORDER' }, { orderId: { not: null } }] },
        ],
      });
    }

    if (filters.status != null) andFilters.push({ status: filters.status });
    if ('rating' in filters && filters.rating != null) andFilters.push({ rating: filters.rating });

    if (filters.branchId != null) {
      // Branch filter is applied via feedback.order.branchId (ORDER feedback only).
      andFilters.push({ order: { is: { branchId: filters.branchId } } });
    }

    if (filters.dateFrom != null || filters.dateTo != null) {
      const createdAt: Record<string, Date> = {};
      if (filters.dateFrom != null) createdAt.gte = filters.dateFrom;
      if (filters.dateTo != null) createdAt.lte = filters.dateTo;
      andFilters.push({ createdAt });
    }

    return andFilters.length ? { AND: andFilters } : {};
  }

  async create(input: CreateFeedbackInput): Promise<FeedbackRecord> {
    try {
      const id = randomUUID();
      const tagsText = formatTagsAsLegacyTextColumnValue(input.tags ?? []);
      await this.prismaClient.$executeRaw(
        Prisma.sql`
          INSERT INTO "Feedback" ("id", "userId", "orderId", "type", "rating", "tags", "message", "status", "adminNotes", "createdAt", "updatedAt")
          VALUES (
            ${id},
            ${input.userId ?? null},
            ${input.orderId ?? null},
            ${input.type}::"FeedbackType",
            ${input.rating ?? null},
            ${tagsText}::text[],
            ${input.message ?? null},
            ${(input.status as 'NEW' | 'REVIEWED' | 'RESOLVED') ?? 'NEW'}::"FeedbackStatus",
            ${null},
            NOW(),
            NOW()
          )
        `,
      );
      const row = await this.prisma.feedback.findUnique({
        where: { id },
        select: FEEDBACK_SELECT_NO_TAGS,
      });
      if (!row) throw new Error('Feedback created but could not be reloaded');
      return toRecord(row);
    } catch (e) {
      if (
        isPrismaUniqueConstraint(e) ||
        (e instanceof Error &&
          (e.message.includes('duplicate key value violates unique constraint') ||
            e.message.includes('Feedback_orderId_key')))
      ) {
        throw new AppError(
          'FEEDBACK_ALREADY_EXISTS',
          'Feedback already submitted for this order',
          { orderId: input.orderId },
        );
      }
      throw e;
    }
  }

  async getById(id: string): Promise<FeedbackRecord | null> {
    const row = await this.prisma.feedback.findUnique({
      where: { id },
      select: FEEDBACK_SELECT_NO_TAGS,
    });
    return row ? toRecord(row) : null;
  }

  async getByOrderId(orderId: string): Promise<FeedbackRecord | null> {
    const row = await this.prisma.feedback.findUnique({
      where: { orderId },
      select: FEEDBACK_SELECT_NO_TAGS,
    });
    return row ? toRecord(row) : null;
  }

  async listAdmin(filters: AdminFeedbackFilters): Promise<AdminFeedbackResult> {
    const where = this.buildAdminWhere(filters);
    const rows = await this.prisma.feedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit + 1,
      cursor: filters.cursor ? { id: filters.cursor } : undefined,
      skip: filters.cursor ? 1 : 0,
      select: {
        id: true,
        userId: true,
        orderId: true,
        type: true,
        rating: true,
        // Avoid selecting tags in admin list due legacy DB rows with inconsistent tags data type.
        message: true,
        status: true,
        adminNotes: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: { name: true, phone: true },
        },
      },
    });
    const data = rows.slice(0, filters.limit).map((r) =>
      toRecord({
        ...(r as any),
        customerName: (r as any).user?.name ?? null,
        customerPhone: (r as any).user?.phone ?? null,
      }),
    );
    const nextCursor = rows.length > filters.limit ? rows[filters.limit - 1].id : null;
    return { data, nextCursor };
  }

  async getRatingStats(filters: AdminFeedbackRatingStatsFilters): Promise<AdminFeedbackRatingStatsResult> {
    const where = this.buildAdminWhere(filters);
    // Only count rated feedback.
    const ratedWhere = { AND: [where, { rating: { not: null } }] };

    const [totalRatedCount, sumRes, c1, c2, c3, c4, c5] = await Promise.all([
      this.prisma.feedback.count({ where: ratedWhere as any }),
      this.prisma.feedback.aggregate({
        where: ratedWhere as any,
        _sum: { rating: true },
      }),
      this.prisma.feedback.count({ where: { AND: [ratedWhere as any, { rating: 1 }] } as any }),
      this.prisma.feedback.count({ where: { AND: [ratedWhere as any, { rating: 2 }] } as any }),
      this.prisma.feedback.count({ where: { AND: [ratedWhere as any, { rating: 3 }] } as any }),
      this.prisma.feedback.count({ where: { AND: [ratedWhere as any, { rating: 4 }] } as any }),
      this.prisma.feedback.count({ where: { AND: [ratedWhere as any, { rating: 5 }] } as any }),
    ]);

    const sumRating = sumRes._sum.rating ?? 0;
    const avgRating = totalRatedCount > 0 ? sumRating / totalRatedCount : null;

    return {
      avgRating,
      totalRated: totalRatedCount,
      ratingCounts: { 1: c1, 2: c2, 3: c3, 4: c4, 5: c5 },
    };
  }

  async updateStatus(
    id: string,
    status: FeedbackStatus,
    adminNotes?: string | null,
  ): Promise<FeedbackRecord> {
    await this.prisma.feedback.update({
      where: { id },
      data: {
        status: status as 'NEW' | 'REVIEWED' | 'RESOLVED',
        ...(adminNotes !== undefined && { adminNotes }),
      },
    });
    const row = await this.prisma.feedback.findUnique({
      where: { id },
      select: FEEDBACK_SELECT_NO_TAGS,
    });
    if (!row) throw new Error('Feedback updated but could not be reloaded');
    return toRecord(row);
  }

  async listForCustomer(userId: string): Promise<FeedbackRecord[]> {
    const rows = await this.prisma.feedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: FEEDBACK_SELECT_NO_TAGS,
    });
    return rows.map(toRecord);
  }
}
