import { OrderStatus, OrderType, ServiceType } from '@shared/enums';
import type {
  CreateOrderInput,
  OrderRecord,
  OrdersRepo,
  AdminOrdersFilters,
  AdminOrdersResult,
  AdminOrderListRow,
  OrderAdminSummary,
  CreateSubscriptionUsageInput,
  SubscriptionUsageRecord,
  SubscriptionUsageRepo,
  SubscriptionRecord,
  SubscriptionsRepo,
  CreateSubscriptionInput,
  ActiveSubscriptionWithPlanRecord,
  ServiceAreaRepo,
  ServiceAreaRecord,
  SlotConfigRepo,
  SlotIdentifier,
  SlotConfigRecord,
  HolidaysRepo,
  OperatingHoursRepo,
  OperatingHoursRecord,
  FeedbackRepo,
  FeedbackRecord,
  CreateFeedbackInput,
  AdminFeedbackFilters,
  AdminFeedbackResult,
  AdminFeedbackRatingStatsFilters,
  AdminFeedbackRatingStatsResult,
} from '../../ports';
import { FeedbackStatus } from '@shared/enums';

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function createFakeOrdersRepo(initial: OrderRecord[] = []): OrdersRepo & { records: OrderRecord[] } {
  const records: OrderRecord[] = [...initial];
  return {
    records,
    async create(data: CreateOrderInput): Promise<OrderRecord> {
      const now = new Date();
      const serviceTypes = data.serviceTypes?.length ? data.serviceTypes : [data.serviceType];
      const order: OrderRecord = {
        id: uuid(),
        userId: data.userId,
        orderType: data.orderType ?? OrderType.INDIVIDUAL,
        orderSource: data.orderSource ?? null,
        serviceType: data.serviceType as ServiceType,
        serviceTypes: serviceTypes as OrderRecord['serviceTypes'],
        addressId: data.addressId,
        addressLabel: data.addressLabel ?? null,
        addressLine: data.addressLine ?? null,
        pincode: data.pincode,
        pickupDate: data.pickupDate,
        timeWindow: data.timeWindow,
        estimatedWeightKg: data.estimatedWeightKg ?? null,
        actualWeightKg: null,
        status: OrderStatus.BOOKING_CONFIRMED,
        subscriptionId: data.subscriptionId ?? null,
        branchId: data.branchId ?? null,
        paymentStatus: 'PENDING',
        createdAt: now,
        updatedAt: now,
        confirmedAt: null,
        pickedUpAt: null,
        inProgressAt: null,
        readyAt: null,
        outForDeliveryAt: null,
        deliveredAt: null,
      };
      records.push(order);
      return order;
    },
    async getById(id: string): Promise<OrderRecord | null> {
      return records.find((r) => r.id === id) ?? null;
    },
    async findActiveBySubscriptionId(subscriptionId: string): Promise<OrderRecord | null> {
      const active = records
        .filter(
          (r) =>
            r.subscriptionId === subscriptionId &&
            r.status !== OrderStatus.DELIVERED &&
            r.status !== OrderStatus.CANCELLED,
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return active.length > 0 ? active[0]! : null;
    },
    async updateStatus(orderId: string, status: OrderStatus, _options?: { cancellationReason?: string | null }): Promise<OrderRecord> {
      const i = records.findIndex((r) => r.id === orderId);
      if (i < 0) throw new Error('Order not found');
      const now = new Date();
      const prev = records[i];
      const updates: Partial<OrderRecord> = { status, updatedAt: now };
      if (status === OrderStatus.PICKUP_SCHEDULED) updates.confirmedAt = prev.confirmedAt ?? now;
      if (status === OrderStatus.PICKED_UP) updates.pickedUpAt = prev.pickedUpAt ?? now;
      if (status === OrderStatus.IN_PROCESSING) updates.inProgressAt = prev.inProgressAt ?? now;
      if (status === OrderStatus.READY) updates.readyAt = prev.readyAt ?? now;
      if (status === OrderStatus.OUT_FOR_DELIVERY) updates.outForDeliveryAt = prev.outForDeliveryAt ?? now;
      if (status === OrderStatus.DELIVERED) updates.deliveredAt = prev.deliveredAt ?? now;
      records[i] = { ...prev, ...updates };
      return records[i];
    },
    async listByUser(userId: string, branchId?: string | null): Promise<OrderRecord[]> {
      return records.filter((r) => {
        if (r.userId !== userId) return false;
        if (branchId != null && (r as OrderRecord & { branchId?: string | null }).branchId !== branchId) return false;
        return true;
      });
    },
    async listByUserForCustomer(userId: string): Promise<Array<OrderRecord & {
      amountToPayPaise: number | null;
      subscriptionUsageKg: number | null;
      subscriptionUsageItems: number | null;
    }>> {
      return records
        .filter((r) => r.userId === userId)
        .map((r) => ({ ...r, amountToPayPaise: null, subscriptionUsageKg: null, subscriptionUsageItems: null }));
    },
    async countByUserCreatedBefore(userId: string, createdAt: Date): Promise<number> {
      return records.filter((r) => r.userId === userId && r.createdAt <= createdAt).length;
    },
    async getOrderCountsByUserIds(userIds: string[]): Promise<Record<string, { past: number; active: number }>> {
      const out: Record<string, { past: number; active: number }> = {};
      userIds.forEach((id) => { out[id] = { past: 0, active: 0 }; });
      for (const r of records.filter((o) => userIds.includes(o.userId))) {
        if (r.status === OrderStatus.DELIVERED || r.status === OrderStatus.CANCELLED) out[r.userId].past++;
        else out[r.userId].active++;
      }
      return out;
    },
    async updatePaymentStatus(orderId: string, paymentStatus: string): Promise<OrderRecord> {
      const i = records.findIndex((r) => r.id === orderId);
      if (i < 0) throw new Error('Order not found');
      records[i] = { ...records[i], paymentStatus, updatedAt: new Date() };
      return records[i];
    },
    async updateSubscriptionId(orderId: string, subscriptionId: string): Promise<OrderRecord> {
      const i = records.findIndex((r) => r.id === orderId);
      if (i < 0) throw new Error('Order not found');
      records[i] = { ...records[i], subscriptionId, updatedAt: new Date() };
      return records[i];
    },
    async listBySubscriptionId(subscriptionId: string): Promise<OrderRecord[]> {
      return records
        .filter((r) => r.subscriptionId === subscriptionId)
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    },
    async adminList(filters: AdminOrdersFilters): Promise<AdminOrdersResult> {
      let list = [...records];
      if (filters.status != null) list = list.filter((r) => r.status === filters.status);
      if (filters.pincode != null) list = list.filter((r) => r.pincode === filters.pincode);
      if (filters.serviceType != null) list = list.filter((r) => r.serviceType === filters.serviceType);
      if (filters.customerId != null) list = list.filter((r) => r.userId === filters.customerId);
      if (filters.orderSource != null) list = list.filter((r) => r.orderSource === filters.orderSource);
      const sq = filters.search?.trim();
      if (sq) {
        const sl = sq.toLowerCase();
        list = list.filter((r) => r.id.toLowerCase().includes(sl));
      }
      if (filters.branchId != null) list = list.filter((r) => r.branchId === filters.branchId);
      if (filters.dateFrom != null) list = list.filter((r) => r.pickupDate >= filters.dateFrom!);
      if (filters.dateTo != null) list = list.filter((r) => r.pickupDate <= filters.dateTo!);
      const start = filters.cursor ? list.findIndex((r) => r.id === filters.cursor) + 1 : 0;
      const slice = list.slice(start, start + filters.limit + 1);
      const data: AdminOrderListRow[] = slice.slice(0, filters.limit).map((r) => ({
        ...r,
        customerName: null,
        customerAddress: r.pincode,
        branchName: null,
        deliveredDate: null,
        billTotalPaise: null,
        billSubtotalPaise: null,
        billTaxPaise: null,
        billDiscountPaise: null,
        billTypeLabel: r.orderSource === 'WALK_IN' ? 'Walkin' : '—',
        ackIssuedAt: null,
        finalIssuedAt: null,
        paymentFailureReason: null,
      }));
      const nextCursor = slice.length > filters.limit ? slice[filters.limit - 1].id : null;
      return { data, nextCursor };
    },
    async getAdminSummary(orderId: string): Promise<OrderAdminSummary | null> {
      const order = records.find((r) => r.id === orderId);
      if (!order) return null;
      return {
        order,
        customer: { id: order.userId, name: null, phone: null, email: null },
        address: { id: '', label: '', addressLine: '', pincode: order.pincode, googleMapUrl: null },
        branch: null,
        orderItems: [],
        subscription: null,
        activeSubscriptions: [],
        subscriptionUsage: null,
        invoices: [],
        payment: null,
      };
    },
  };
}

export function createFakeSubscriptionsRepo(
  initial: (Partial<SubscriptionRecord> & Pick<SubscriptionRecord, 'id' | 'userId' | 'planId' | 'remainingPickups' | 'expiryDate' | 'active'>)[] = [],
): SubscriptionsRepo & { records: SubscriptionRecord[] } {
  const records: SubscriptionRecord[] = initial.map((s) => ({
    usedKg: 0,
    usedItemsCount: 0,
    branchId: null,
    addressId: (s as Partial<SubscriptionRecord>).addressId ?? null,
    totalMaxPickups: null,
    totalKgLimit: null,
    totalItemsLimit: null,
    validityStartDate: (s as Partial<SubscriptionRecord>).validityStartDate ?? new Date(),
    ...s,
  } as SubscriptionRecord));
  const toActiveWithPlan = (sub: SubscriptionRecord): ActiveSubscriptionWithPlanRecord => ({
    id: sub.id,
    planId: sub.planId,
    planName: 'Test Plan',
    addressId: sub.addressId ?? null,
    validityStartDate: sub.validityStartDate,
    validTill: sub.expiryDate,
    remainingPickups: sub.remainingPickups,
    remainingKg: (sub.totalKgLimit ?? 10) - sub.usedKg,
    remainingItems: (sub.totalItemsLimit ?? 5) - sub.usedItemsCount,
    maxPickups: sub.totalMaxPickups ?? 999,
    kgLimit: sub.totalKgLimit ?? 10,
    itemsLimit: sub.totalItemsLimit ?? 5,
    usedKg: sub.usedKg,
    usedItemsCount: sub.usedItemsCount,
  });
  return {
    records,
    async getById(id: string): Promise<SubscriptionRecord | null> {
      return records.find((r) => r.id === id) ?? null;
    },
    async findActiveByUserId(userId: string): Promise<{ id: string } | null> {
      const sub = records.find((r) => r.userId === userId && r.active && r.expiryDate >= new Date() && r.remainingPickups > 0);
      return sub ? { id: sub.id } : null;
    },
    async listActiveByUserId(userId: string, branchId?: string | null): Promise<ActiveSubscriptionWithPlanRecord[]> {
      const active = records.filter((r) => {
        if (r.userId !== userId || !r.active || r.expiryDate < new Date() || r.remainingPickups <= 0) return false;
        if (branchId != null && r.branchId !== branchId) return false;
        return true;
      });
      return active.map(toActiveWithPlan);
    },
    async findActiveWithPlanByUserId(userId: string): Promise<ActiveSubscriptionWithPlanRecord | null> {
      const list = await this.listActiveByUserId(userId);
      return list[0] ?? null;
    },
    async findActiveByUserIdAndPlanId(userId: string, planId: string): Promise<SubscriptionRecord | null> {
      return records.find((r) => r.userId === userId && r.planId === planId && r.active && r.expiryDate >= new Date() && r.remainingPickups > 0) ?? null;
    },
    async hasEverRedeemedPlan(userId: string, planId: string): Promise<boolean> {
      return records.some((r) => r.userId === userId && r.planId === planId);
    },
    async countActive(): Promise<number> {
      return records.filter((r) => r.active).length;
    },
    async create(data: CreateSubscriptionInput): Promise<SubscriptionRecord> {
      const rec: SubscriptionRecord = {
        id: uuid(),
        userId: data.userId,
        planId: data.planId,
        branchId: data.branchId ?? null,
        addressId: data.addressId ?? null,
        validityStartDate: data.validityStartDate,
        remainingPickups: data.remainingPickups,
        usedKg: 0,
        usedItemsCount: 0,
        expiryDate: data.expiryDate,
        active: true,
        totalMaxPickups: data.totalMaxPickups ?? null,
        totalKgLimit: data.totalKgLimit ?? null,
        totalItemsLimit: data.totalItemsLimit ?? null,
      };
      records.push(rec);
      return rec;
    },
    async extendSubscription(
      subscriptionId: string,
      params: { quantityMonths: number; planMaxPickups: number; planValidityDays: number; planKgLimit: number | null; planItemsLimit: number | null },
    ): Promise<SubscriptionRecord> {
      const i = records.findIndex((r) => r.id === subscriptionId);
      if (i < 0) throw new Error('Subscription not found');
      const sub = records[i];
      const addPickups = params.planMaxPickups * params.quantityMonths;
      const newExpiry = new Date(sub.expiryDate);
      newExpiry.setDate(newExpiry.getDate() + params.planValidityDays * params.quantityMonths);
      records[i] = {
        ...sub,
        remainingPickups: sub.remainingPickups + addPickups,
        expiryDate: newExpiry,
        totalMaxPickups: (sub.totalMaxPickups ?? sub.remainingPickups) + addPickups,
        totalKgLimit: params.planKgLimit != null ? (sub.totalKgLimit ?? 0) + params.planKgLimit * params.quantityMonths : sub.totalKgLimit,
        totalItemsLimit: params.planItemsLimit != null ? (sub.totalItemsLimit ?? 0) + params.planItemsLimit * params.quantityMonths : sub.totalItemsLimit,
      };
      return records[i];
    },
    async updateRemainingPickups(
      subscriptionId: string,
      remainingPickups: number,
    ): Promise<SubscriptionRecord> {
      const i = records.findIndex((r) => r.id === subscriptionId);
      if (i < 0) throw new Error('Subscription not found');
      records[i] = { ...records[i], remainingPickups };
      return records[i];
    },
    async updateUsage(
      subscriptionId: string,
      data: { remainingPickups: number; usedKg: number; usedItemsCount: number },
    ): Promise<SubscriptionRecord> {
      const i = records.findIndex((r) => r.id === subscriptionId);
      if (i < 0) throw new Error('Subscription not found');
      records[i] = { ...records[i], ...data };
      return records[i];
    },
    async setInactive(subscriptionId: string): Promise<SubscriptionRecord> {
      const i = records.findIndex((r) => r.id === subscriptionId);
      if (i < 0) throw new Error('Subscription not found');
      records[i] = { ...records[i], active: false };
      return records[i];
    },
    async listPastByUserId(
      userId: string,
      branchId?: string | null,
    ): Promise<(SubscriptionRecord & { planName: string; maxPickups: number; kgLimit: number | null; itemsLimit: number | null; inactivatedAt: Date })[]> {
      return records
        .filter((r) => {
          if (r.userId !== userId || r.active) return false;
          if (branchId != null && r.branchId !== branchId) return false;
          return true;
        })
        .map((r) => ({
          ...r,
          planName: 'Test Plan',
          maxPickups: r.totalMaxPickups ?? 0,
          kgLimit: r.totalKgLimit ?? null,
          itemsLimit: r.totalItemsLimit ?? null,
          inactivatedAt: new Date(),
        }));
    },
    async getSubscriptionCountsByUserIds(userIds: string[]): Promise<Record<string, { active: number; inactive: number }>> {
      const out: Record<string, { active: number; inactive: number }> = {};
      userIds.forEach((id) => { out[id] = { active: 0, inactive: 0 }; });
      for (const r of records.filter((s) => userIds.includes(s.userId))) {
        if (r.active) out[r.userId].active++;
        else out[r.userId].inactive++;
      }
      return out;
    },
  };
}

/** Enforces unique(orderId, subscriptionId) and unique(invoiceId, subscriptionId) when invoiceId set. */
export function createFakeSubscriptionUsageRepo(
  initial: SubscriptionUsageRecord[] = [],
): SubscriptionUsageRepo & { records: SubscriptionUsageRecord[] } {
  const records: SubscriptionUsageRecord[] = initial.map((u) => ({ ...u, invoiceId: u.invoiceId ?? null }));
  return {
    records,
    async create(data: CreateSubscriptionUsageInput): Promise<SubscriptionUsageRecord> {
      const invoiceId = data.invoiceId ?? null;
      if (invoiceId) {
        const existingByInvoice = records.find((r) => r.invoiceId === invoiceId && r.subscriptionId === data.subscriptionId);
        if (existingByInvoice) {
          const err = new Error('Unique constraint on invoiceId+subscriptionId') as Error & { code?: string };
          err.code = 'UNIQUE_CONSTRAINT';
          throw err;
        }
      } else {
        const existing = records.find((r) => r.orderId === data.orderId && r.subscriptionId === data.subscriptionId);
        if (existing) {
          const err = new Error('Unique constraint on orderId+subscriptionId') as Error & { code?: string };
          err.code = 'UNIQUE_CONSTRAINT';
          throw err;
        }
      }
      const usage: SubscriptionUsageRecord = {
        id: uuid(),
        subscriptionId: data.subscriptionId,
        orderId: data.orderId,
        invoiceId,
        deductedPickups: data.deductedPickups ?? 1,
        deductedKg: data.deductedKg ?? 0,
        deductedItemsCount: data.deductedItemsCount ?? 0,
        createdAt: new Date(),
      };
      records.push(usage);
      return usage;
    },
    async findByOrderId(orderId: string): Promise<SubscriptionUsageRecord | null> {
      return records.find((r) => r.orderId === orderId) ?? null;
    },
    async findByOrderIdAndSubscriptionId(orderId: string, subscriptionId: string): Promise<SubscriptionUsageRecord | null> {
      return records.find((r) => r.orderId === orderId && r.subscriptionId === subscriptionId) ?? null;
    },
    async findByInvoiceIdAndSubscriptionId(invoiceId: string, subscriptionId: string): Promise<SubscriptionUsageRecord | null> {
      return records.find((r) => r.invoiceId === invoiceId && r.subscriptionId === subscriptionId) ?? null;
    },
    async listOrderIdsBySubscriptionId(subscriptionId: string): Promise<string[]> {
      return [...new Set(records.filter((r) => r.subscriptionId === subscriptionId).map((r) => r.orderId))];
    },
    async updateDeductedAmounts(orderId: string, subscriptionId: string, deductedKg: number, deductedItemsCount: number): Promise<void> {
      const r = records.find((rec) => rec.orderId === orderId && rec.subscriptionId === subscriptionId);
      if (r) {
        r.deductedKg = deductedKg;
        r.deductedItemsCount = deductedItemsCount;
      }
    },
  };
}

const DEFAULT_FAKE_BRANCH_ID = 'branch-1';

export function createFakeServiceAreaRepo(
  serviceablePincodes: Set<string> = new Set(),
): ServiceAreaRepo {
  const pincodes = Array.from(serviceablePincodes);
  const toRecord = (pincode: string, branchId: string = DEFAULT_FAKE_BRANCH_ID, active = true): ServiceAreaRecord => ({
    id: `area-${pincode}`,
    pincode,
    branchId,
    active,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return {
    async isServiceable(pincode: string): Promise<boolean> {
      return serviceablePincodes.has(pincode);
    },
    async listAll(): Promise<ServiceAreaRecord[]> {
      return pincodes.map((p) => toRecord(p));
    },
    async listByBranchId(branchId: string): Promise<ServiceAreaRecord[]> {
      return pincodes.map((p) => toRecord(p, branchId));
    },
    async getByPincode(pincode: string): Promise<ServiceAreaRecord | null> {
      if (!serviceablePincodes.has(pincode)) return null;
      return toRecord(pincode);
    },
    async upsert(pincode: string, branchId: string, active: boolean): Promise<ServiceAreaRecord> {
      serviceablePincodes.add(pincode);
      return toRecord(pincode, branchId, active);
    },
    async setActive(pincode: string, active: boolean): Promise<ServiceAreaRecord> {
      if (!serviceablePincodes.has(pincode)) serviceablePincodes.add(pincode);
      return toRecord(pincode, DEFAULT_FAKE_BRANCH_ID, active);
    },
    async update(pincode: string, patch: { branchId?: string; active?: boolean }): Promise<ServiceAreaRecord> {
      if (!serviceablePincodes.has(pincode)) serviceablePincodes.add(pincode);
      return toRecord(pincode, patch.branchId ?? DEFAULT_FAKE_BRANCH_ID, patch.active ?? true);
    },
    async remove(pincode: string): Promise<void> {
      serviceablePincodes.delete(pincode);
    },
  };
}

export function createFakeSlotConfigRepo(opts?: {
  slot?: SlotConfigRecord;
  existingCount?: number;
}): SlotConfigRepo {
  const slot = opts?.slot ?? null;
  const count = opts?.existingCount ?? 0;
  return {
    async getSlot(_id: SlotIdentifier): Promise<SlotConfigRecord | null> {
      return slot;
    },
    async countOrdersForSlot(_id: SlotIdentifier): Promise<number> {
      return count;
    },
    async createSlot(id: SlotIdentifier, capacity: number): Promise<SlotConfigRecord> {
      return {
        id: uuid(),
        date: id.date,
        timeWindow: id.timeWindow,
        pincode: id.pincode,
        capacity,
      };
    },
  };
}

export function createFakeHolidaysRepo(opts?: { isHoliday?: boolean }): HolidaysRepo {
  const isHoliday = opts?.isHoliday ?? false;
  return {
    async isHoliday(_date: Date, _branchId?: string | null): Promise<boolean> {
      return isHoliday;
    },
    async list(_from: Date, _to: Date, _branchId?: string | null): Promise<{ id: string; date: Date; label: string | null; branchId: string | null }[]> {
      return [];
    },
    async add(date: Date, label?: string | null, branchId?: string | null) {
      return { id: uuid(), date, label: label ?? null, branchId: branchId ?? null };
    },
    async update(id: string, patch: { date?: Date; label?: string | null; branchId?: string | null }) {
      return { id, date: patch.date ?? new Date(), label: patch.label ?? null, branchId: patch.branchId ?? null };
    },
    async remove(): Promise<void> {},
  };
}

export function createFakeOperatingHoursRepo(opts?: {
  get?: OperatingHoursRecord | null;
}): OperatingHoursRepo {
  const hours = opts?.get ?? null;
  return {
    async get(_branchId?: string | null): Promise<OperatingHoursRecord | null> {
      return hours;
    },
    async set(branchId: string | null, startTime: string, endTime: string): Promise<OperatingHoursRecord> {
      return { id: 'default', branchId, startTime, endTime };
    },
  };
}

export function createFakeFeedbackRepo(
  initial: FeedbackRecord[] = [],
): FeedbackRepo & { records: FeedbackRecord[] } {
  const records: FeedbackRecord[] = [...initial];
  return {
    records,
    async create(input: CreateFeedbackInput): Promise<FeedbackRecord> {
      if (input.orderId != null) {
        const existing = records.find((r) => r.orderId === input.orderId);
        if (existing) {
          const err = new Error('FEEDBACK_ALREADY_EXISTS') as Error & { code?: string };
          err.code = 'FEEDBACK_ALREADY_EXISTS';
          throw err;
        }
      }
      const rec: FeedbackRecord = {
        id: uuid(),
        userId: input.userId ?? null,
        orderId: input.orderId ?? null,
        customerName: null,
        customerPhone: null,
        type: input.type,
        rating: input.rating ?? null,
        tags: input.tags ?? [],
        message: input.message ?? null,
        status: (input.status as FeedbackStatus) ?? FeedbackStatus.NEW,
        adminNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      records.push(rec);
      return rec;
    },
    async getById(id: string): Promise<FeedbackRecord | null> {
      return records.find((r) => r.id === id) ?? null;
    },
    async getByOrderId(orderId: string): Promise<FeedbackRecord | null> {
      return records.find((r) => r.orderId === orderId) ?? null;
    },
    async listAdmin(filters: AdminFeedbackFilters): Promise<AdminFeedbackResult> {
      let list = [...records];
      if (filters.type != null) list = list.filter((r) => r.type === filters.type);
      if (filters.status != null) list = list.filter((r) => r.status === filters.status);
      if (filters.rating != null) list = list.filter((r) => r.rating === filters.rating);
      // NOTE: in-memory feedback repo has no branch relation, so branchId filtering is ignored.
      if (filters.dateFrom != null) list = list.filter((r) => r.createdAt >= filters.dateFrom!);
      if (filters.dateTo != null) list = list.filter((r) => r.createdAt <= filters.dateTo!);
      const start = filters.cursor ? list.findIndex((r) => r.id === filters.cursor) + 1 : 0;
      const slice = list.slice(start, start + filters.limit + 1);
      const data = slice.slice(0, filters.limit);
      const nextCursor = slice.length > filters.limit ? slice[filters.limit - 1].id : null;
      return { data, nextCursor };
    },
    async getRatingStats(filters: AdminFeedbackRatingStatsFilters): Promise<AdminFeedbackRatingStatsResult> {
      const list = records.filter((r) => {
        if (filters.type != null && r.type !== filters.type) return false;
        if (filters.status != null && r.status !== filters.status) return false;
        if (filters.dateFrom != null && r.createdAt < filters.dateFrom) return false;
        if (filters.dateTo != null && r.createdAt > filters.dateTo) return false;
        // NOTE: branchId is ignored in this in-memory implementation (no order join).
        return r.rating != null;
      });
      const ratingCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      let sum = 0;
      for (const r of list) {
        const rating = r.rating ?? 0;
        if (ratingCounts[rating as keyof typeof ratingCounts] != null) {
          ratingCounts[rating as keyof typeof ratingCounts] += 1;
        }
        sum += rating;
      }
      const totalRated = list.length;
      const avgRating = totalRated > 0 ? sum / totalRated : null;
      return { avgRating, totalRated, ratingCounts };
    },
    async updateStatus(
      id: string,
      status: FeedbackStatus,
      adminNotes?: string | null,
    ): Promise<FeedbackRecord> {
      const i = records.findIndex((r) => r.id === id);
      if (i < 0) throw new Error('Feedback not found');
      records[i] = { ...records[i], status, adminNotes: adminNotes ?? records[i].adminNotes, updatedAt: new Date() };
      return records[i];
    },
    async listForCustomer(userId: string): Promise<FeedbackRecord[]> {
      return records.filter((r) => r.userId === userId);
    },
  };
}

