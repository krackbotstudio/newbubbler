import type { PrismaClient } from '@prisma/client';
import type {
  SubscriptionRecord,
  SubscriptionsRepo,
  ActiveSubscriptionRecord,
  ActiveSubscriptionWithPlanRecord,
  CreateSubscriptionInput,
} from '../../../application/ports';

type PrismaLike = Pick<PrismaClient, 'subscription'>;

function toSubscriptionRecord(row: {
  id: string;
  userId: string;
  planId: string;
  branchId: string | null;
  addressId?: string | null;
  validityStartDate: Date;
  remainingPickups: number;
  usedKg: unknown;
  usedItemsCount: number;
  expiryDate: Date;
  active: boolean;
  totalMaxPickups?: number | null;
  totalKgLimit?: unknown;
  totalItemsLimit?: number | null;
}): SubscriptionRecord {
  return {
    id: row.id,
    userId: row.userId,
    planId: row.planId,
    branchId: row.branchId,
    addressId: row.addressId ?? null,
    validityStartDate: row.validityStartDate,
    remainingPickups: row.remainingPickups,
    usedKg: Number(row.usedKg ?? 0),
    usedItemsCount: row.usedItemsCount ?? 0,
    expiryDate: row.expiryDate,
    active: row.active,
    totalMaxPickups: row.totalMaxPickups ?? null,
    totalKgLimit: row.totalKgLimit != null ? Number(row.totalKgLimit) : null,
    totalItemsLimit: row.totalItemsLimit ?? null,
  };
}

export class PrismaSubscriptionsRepo implements SubscriptionsRepo {
  constructor(private readonly prisma: PrismaLike) {}

  async getById(id: string): Promise<SubscriptionRecord | null> {
    const sub = await this.prisma.subscription.findUnique({
      where: { id },
    });
    return sub ? toSubscriptionRecord(sub) : null;
  }

  async findActiveByUserId(userId: string): Promise<ActiveSubscriptionRecord | null> {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, active: true },
      select: { id: true },
    });
    return sub;
  }

  async countActive(): Promise<number> {
    return this.prisma.subscription.count({ where: { active: true } });
  }

  async countActiveForBranch(branchId: string): Promise<number> {
    return this.prisma.subscription.count({ where: { active: true, branchId } });
  }

  async listActiveByUserId(userId: string, branchId?: string | null): Promise<ActiveSubscriptionWithPlanRecord[]> {
    const subs = await (this.prisma as PrismaClient).subscription.findMany({
      where: {
        userId,
        active: true,
        ...(branchId != null ? { branchId } : {}),
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    const now = new Date();
    const out: ActiveSubscriptionWithPlanRecord[] = [];
    for (const sub of subs) {
      if (sub.expiryDate < now || sub.remainingPickups <= 0) continue;
      const kgLimit = sub.totalKgLimit != null ? Number(sub.totalKgLimit) : (sub.plan.kgLimit != null ? Number(sub.plan.kgLimit) : null);
      const itemsLimit = sub.totalItemsLimit ?? sub.plan.itemsLimit ?? null;
      if (kgLimit != null && Number(sub.usedKg) >= kgLimit) continue;
      if (itemsLimit != null && sub.usedItemsCount >= itemsLimit) continue;
      const usedKg = Number(sub.usedKg ?? 0);
      const usedItems = sub.usedItemsCount ?? 0;
      const maxPickups = sub.totalMaxPickups ?? sub.plan.maxPickups;
      out.push({
        id: sub.id,
        planId: sub.planId,
        planName: sub.plan.name,
        addressId: sub.addressId ?? null,
        addressLabel: (sub as { addressLabel?: string | null }).addressLabel ?? null,
        validityStartDate: sub.validityStartDate,
        validTill: sub.expiryDate,
        remainingPickups: sub.remainingPickups,
        remainingKg: kgLimit != null ? Math.max(0, kgLimit - usedKg) : null,
        remainingItems: itemsLimit != null ? Math.max(0, itemsLimit - usedItems) : null,
        maxPickups,
        kgLimit,
        itemsLimit,
        usedKg,
        usedItemsCount: usedItems,
      });
    }
    return out;
  }

  async findActiveWithPlanByUserId(userId: string): Promise<ActiveSubscriptionWithPlanRecord | null> {
    const list = await this.listActiveByUserId(userId);
    return list[0] ?? null;
  }

  async findActiveByUserIdAndPlanId(userId: string, planId: string): Promise<SubscriptionRecord | null> {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, planId, active: true },
    });
    if (!sub) return null;
    if (sub.expiryDate < new Date() || sub.remainingPickups <= 0) return null;
    return toSubscriptionRecord(sub);
  }

  async hasEverRedeemedPlan(userId: string, planId: string): Promise<boolean> {
    const count = await this.prisma.subscription.count({
      where: { userId, planId },
    });
    return count > 0;
  }

  async extendSubscription(
    subscriptionId: string,
    params: { quantityMonths: number; planMaxPickups: number; planValidityDays: number; planKgLimit: number | null; planItemsLimit: number | null },
  ): Promise<SubscriptionRecord> {
    const sub = await this.prisma.subscription.findUnique({ where: { id: subscriptionId } });
    if (!sub) throw new Error('Subscription not found');
    const addPickups = params.planMaxPickups * params.quantityMonths;
    const addDays = params.planValidityDays * params.quantityMonths;
    const newRemaining = sub.remainingPickups + addPickups;
    const newExpiry = new Date(sub.expiryDate);
    newExpiry.setDate(newExpiry.getDate() + addDays);
    const newTotalPickups = (sub.totalMaxPickups ?? sub.remainingPickups) + addPickups;
    const baseKg = sub.totalKgLimit != null ? Number(sub.totalKgLimit) : (params.planKgLimit ?? 0);
    const addKg = (params.planKgLimit ?? 0) * params.quantityMonths;
    const newTotalKg = params.planKgLimit != null ? baseKg + addKg : null;
    const baseItems = sub.totalItemsLimit ?? params.planItemsLimit ?? 0;
    const addItems = (params.planItemsLimit ?? 0) * params.quantityMonths;
    const newTotalItems = params.planItemsLimit != null ? baseItems + addItems : null;
    const updated = await (this.prisma as PrismaClient).subscription.update({
      where: { id: subscriptionId },
      data: {
        remainingPickups: newRemaining,
        expiryDate: newExpiry,
        totalMaxPickups: newTotalPickups,
        totalKgLimit: newTotalKg ?? undefined,
        totalItemsLimit: newTotalItems ?? undefined,
      },
    });
    return toSubscriptionRecord(updated);
  }

  async setInactive(subscriptionId: string): Promise<SubscriptionRecord> {
    const sub = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { active: false },
    });
    return toSubscriptionRecord(sub);
  }

  async listPastByUserId(userId: string, branchId?: string | null): Promise<(SubscriptionRecord & {
    planName: string;
    maxPickups: number;
    kgLimit: number | null;
    itemsLimit: number | null;
    inactivatedAt: Date;
    addressLabel?: string | null;
  })[]> {
    const rows = await (this.prisma as PrismaClient).subscription.findMany({
      where: {
        userId,
        active: false,
        ...(branchId != null ? { branchId } : {}),
      },
      include: { plan: true },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => {
      const rec = toSubscriptionRecord(row);
      const maxPickups = rec.totalMaxPickups ?? row.plan.maxPickups;
      const kgLimit = rec.totalKgLimit != null ? rec.totalKgLimit : (row.plan.kgLimit != null ? Number(row.plan.kgLimit) : null);
      const itemsLimit = rec.totalItemsLimit != null ? rec.totalItemsLimit : (row.plan.itemsLimit ?? null);
      return {
        ...rec,
        planName: row.plan.name,
        maxPickups,
        kgLimit,
        itemsLimit,
        inactivatedAt: row.updatedAt,
        addressLabel: (row as { addressLabel?: string | null }).addressLabel ?? null,
      };
    });
  }

  async create(data: CreateSubscriptionInput): Promise<SubscriptionRecord> {
    const sub = await this.prisma.subscription.create({
      data: {
        userId: data.userId,
        planId: data.planId,
        branchId: data.branchId ?? undefined,
        addressId: data.addressId ?? undefined,
        addressLabel: data.addressLabel ?? undefined,
        addressLine: data.addressLine ?? undefined,
        validityStartDate: data.validityStartDate,
        expiryDate: data.expiryDate,
        remainingPickups: data.remainingPickups,
        totalMaxPickups: data.totalMaxPickups ?? undefined,
        totalKgLimit: data.totalKgLimit ?? undefined,
        totalItemsLimit: data.totalItemsLimit ?? undefined,
      },
    });
    return toSubscriptionRecord(sub);
  }

  async updateRemainingPickups(
    subscriptionId: string,
    remainingPickups: number,
  ): Promise<SubscriptionRecord> {
    const sub = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { remainingPickups },
    });
    return toSubscriptionRecord(sub);
  }

  async updateUsage(
    subscriptionId: string,
    data: { remainingPickups: number; usedKg: number; usedItemsCount: number },
  ): Promise<SubscriptionRecord> {
    const sub = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        remainingPickups: data.remainingPickups,
        usedKg: data.usedKg,
        usedItemsCount: data.usedItemsCount,
      },
    });
    return toSubscriptionRecord(sub);
  }

  async getSubscriptionCountsByUserIds(userIds: string[]): Promise<Record<string, { active: number; inactive: number }>> {
    const out: Record<string, { active: number; inactive: number }> = {};
    userIds.forEach((id) => { out[id] = { active: 0, inactive: 0 }; });
    if (userIds.length === 0) return out;
    const [activeRows, inactiveRows] = await Promise.all([
      (this.prisma as PrismaClient).subscription.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, active: true },
        _count: { id: true },
      }),
      (this.prisma as PrismaClient).subscription.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, active: false },
        _count: { id: true },
      }),
    ]);
    activeRows.forEach((r) => { out[r.userId] = out[r.userId] ?? { active: 0, inactive: 0 }; out[r.userId].active = r._count.id; });
    inactiveRows.forEach((r) => { out[r.userId] = out[r.userId] ?? { active: 0, inactive: 0 }; out[r.userId].inactive = r._count.id; });
    return out;
  }
}
