import type { PrismaClient } from '@prisma/client';
import {
  OrderStatus as PrismaOrderStatus,
  PaymentStatus as PrismaPaymentStatus,
  InvoiceType as PrismaInvoiceType,
} from '@prisma/client';
import type {
  CreateOrderInput,
  OrderRecord,
  OrdersRepo,
  AdminOrdersFilters,
  AdminOrdersResult,
  AdminOrderListRow,
  OrderAdminSummary,
} from '../../../application/ports';
import { toIndiaDateKey, indiaDayUtcRange, dateKeyToDdMmYyyy } from '../../../application/time/india-date';

/** Accepts PrismaClient or transaction client from prisma.$transaction(callback). */
type PrismaLike = Pick<
  PrismaClient,
  'order' | 'subscription' | 'serviceArea' | 'branch' | 'segmentCategory' | 'serviceCategory'
>;

function toOrderRecord(row: {
  id: string;
  userId: string;
  orderType: string;
  orderSource?: string | null;
  serviceType: string;
  serviceTypes?: string[];
  addressId: string;
  addressLabel?: string | null;
  addressLine?: string | null;
  pincode: string;
  pickupDate: Date;
  timeWindow: string;
  estimatedWeightKg: unknown;
  actualWeightKg: unknown;
  status: string;
  subscriptionId: string | null;
  branchId?: string | null;
  paymentStatus: string;
  createdAt: Date;
  updatedAt: Date;
  confirmedAt?: Date | null;
  pickedUpAt?: Date | null;
  inProgressAt?: Date | null;
  readyAt?: Date | null;
  outForDeliveryAt?: Date | null;
  deliveredAt?: Date | null;
  cancellationReason?: string | null;
  cancelledAt?: Date | null;
}): OrderRecord {
  const serviceTypes = (row.serviceTypes ?? []) as OrderRecord['serviceTypes'];
  return {
    id: row.id,
    userId: row.userId,
    orderType: (row.orderType ?? 'INDIVIDUAL') as OrderRecord['orderType'],
    orderSource: row.orderSource ?? null,
    serviceType: row.serviceType as OrderRecord['serviceType'],
    serviceTypes: serviceTypes.length > 0 ? serviceTypes : [row.serviceType as OrderRecord['serviceType']],
    addressId: row.addressId,
    addressLabel: row.addressLabel ?? null,
    addressLine: row.addressLine ?? null,
    pincode: row.pincode,
    pickupDate: row.pickupDate,
    timeWindow: row.timeWindow,
    estimatedWeightKg: row.estimatedWeightKg != null ? Number(row.estimatedWeightKg) : null,
    actualWeightKg: row.actualWeightKg != null ? Number(row.actualWeightKg) : null,
    status: row.status as OrderRecord['status'],
    subscriptionId: row.subscriptionId,
    branchId: row.branchId ?? null,
    paymentStatus: row.paymentStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    confirmedAt: row.confirmedAt ?? null,
    pickedUpAt: row.pickedUpAt ?? null,
    inProgressAt: row.inProgressAt ?? null,
    readyAt: row.readyAt ?? null,
    outForDeliveryAt: row.outForDeliveryAt ?? null,
    deliveredAt: row.deliveredAt ?? null,
    cancellationReason: row.cancellationReason ?? null,
    cancelledAt: row.cancelledAt ?? null,
  };
}

/** When transitioning to this status, set the corresponding timestamp. BOOKING_CONFIRMED uses createdAt. */
const STATUS_TO_TIMESTAMP_FIELD: Partial<Record<PrismaOrderStatus, keyof Pick<OrderRecord, 'confirmedAt' | 'pickedUpAt' | 'inProgressAt' | 'readyAt' | 'outForDeliveryAt' | 'deliveredAt'>>> = {
  [PrismaOrderStatus.PICKUP_SCHEDULED]: 'confirmedAt',
  [PrismaOrderStatus.PICKED_UP]: 'pickedUpAt',
  [PrismaOrderStatus.IN_PROCESSING]: 'inProgressAt',
  [PrismaOrderStatus.READY]: 'readyAt',
  [PrismaOrderStatus.OUT_FOR_DELIVERY]: 'outForDeliveryAt',
  [PrismaOrderStatus.DELIVERED]: 'deliveredAt',
};

/** First 3 letters (CAPITAL) of branch name for order number; non-A-Z replaced by X; pad to 3 with X. */
function branchCodeFromName(name: string): string {
  const raw = name
    .slice(0, 3)
    .toUpperCase()
    .replace(/[^A-Z]/g, 'X');
  return raw.padEnd(3, 'X');
}

/** Order number format: BRANCH3 + DDMMYYYY + 0001.. + ON|WI (that day, that branch). */
function buildOrderNumber(branch3: string, dateKeyDdMmYyyy: string, seq: number, orderSource: string | null): string {
  const suffix = orderSource === 'WALK_IN' ? 'WI' : 'ON';
  return `${branch3}${dateKeyDdMmYyyy}${String(seq).padStart(4, '0')}${suffix}`;
}

export class PrismaOrdersRepo implements OrdersRepo {
  constructor(private readonly prisma: PrismaLike) {}

  async create(data: CreateOrderInput): Promise<OrderRecord> {
    const run = async (tx: Pick<PrismaClient, 'order' | 'branch'>) => {
      const now = new Date();
      const dateKey = toIndiaDateKey(now);
      const ddMmYyyy = dateKeyToDdMmYyyy(dateKey);
      const { start: dayStart, end: dayEnd } = indiaDayUtcRange(dateKey);

      let branch3 = 'MAIN';
      let effectiveBranchId: string | null = data.branchId ?? null;

      if (data.branchId) {
        const branch = await tx.branch.findUnique({
          where: { id: data.branchId },
          select: { name: true },
        });
        if (branch?.name) branch3 = branchCodeFromName(branch.name);
      } else {
        // Subscription / customer orders without branchId: use main branch so number and invoices show main branch (not UNK)
        const mainBranch = await tx.branch.findFirst({
          where: { isDefault: true },
          select: { id: true, name: true },
        });
        if (mainBranch?.name) {
          branch3 = branchCodeFromName(mainBranch.name);
          effectiveBranchId = mainBranch.id;
        }
      }

      const count = await tx.order.count({
        where: {
          branchId: effectiveBranchId,
          createdAt: { gte: dayStart, lt: dayEnd },
        },
      });
      const seq = count + 1;
      const id = buildOrderNumber(branch3, ddMmYyyy, seq, data.orderSource ?? null);

      return tx.order.create({
        data: {
          id,
          userId: data.userId,
          orderType: data.orderType as 'INDIVIDUAL' | 'SUBSCRIPTION' | 'BOTH',
          serviceType: data.serviceType,
          serviceTypes: data.serviceTypes ?? [],
          addressId: data.addressId,
          addressLabel: data.addressLabel ?? undefined,
          addressLine: data.addressLine ?? undefined,
          pincode: data.pincode,
          pickupDate: data.pickupDate,
          timeWindow: data.timeWindow,
          estimatedWeightKg: data.estimatedWeightKg != null ? data.estimatedWeightKg : undefined,
          status: PrismaOrderStatus.BOOKING_CONFIRMED,
          subscriptionId: data.subscriptionId ?? undefined,
          branchId: effectiveBranchId ?? undefined,
          orderSource: data.orderSource ?? undefined,
        },
      });
    };

    const order =
      typeof (this.prisma as { $transaction?: unknown }).$transaction === 'function'
        ? await (this.prisma as PrismaClient).$transaction((tx) => run(tx))
        : await run(this.prisma);
    return toOrderRecord(order);
  }

  async getById(id: string): Promise<OrderRecord | null> {
    const order = await this.prisma.order.findUnique({
      where: { id },
    });
    return order ? toOrderRecord(order) : null;
  }

  async findActiveBySubscriptionId(subscriptionId: string): Promise<OrderRecord | null> {
    const order = await this.prisma.order.findFirst({
      where: {
        subscriptionId,
        status: { notIn: [PrismaOrderStatus.DELIVERED, PrismaOrderStatus.CANCELLED] },
      },
      orderBy: { createdAt: 'desc' },
    });
    return order ? toOrderRecord(order) : null;
  }

  async listBySubscriptionId(subscriptionId: string): Promise<OrderRecord[]> {
    const rows = await this.prisma.order.findMany({
      where: { subscriptionId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toOrderRecord);
  }

  async updateStatus(orderId: string, status: OrderRecord['status'], options?: { cancellationReason?: string | null }): Promise<OrderRecord> {
    const prismaStatus = status as PrismaOrderStatus;
    const timestampField = STATUS_TO_TIMESTAMP_FIELD[prismaStatus];
    const data: {
      status: PrismaOrderStatus;
      confirmedAt?: Date;
      pickedUpAt?: Date;
      inProgressAt?: Date;
      readyAt?: Date;
      outForDeliveryAt?: Date;
      deliveredAt?: Date;
      cancellationReason?: string | null;
      cancelledAt?: Date;
    } = { status: prismaStatus };
    if (timestampField) {
      data[timestampField] = new Date();
    }
    if (prismaStatus === PrismaOrderStatus.CANCELLED) {
      if (options?.cancellationReason != null) data.cancellationReason = options.cancellationReason;
      data.cancelledAt = new Date();
    }
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data,
    });
    return toOrderRecord(order);
  }

  async listByUser(userId: string, branchId?: string | null): Promise<OrderRecord[]> {
    const rows = await this.prisma.order.findMany({
      where: {
        userId,
        ...(branchId != null ? { branchId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toOrderRecord);
  }

  async listByUserForCustomer(userId: string): Promise<Array<OrderRecord & {
    amountToPayPaise: number | null;
    subscriptionUsageKg: number | null;
    subscriptionUsageItems: number | null;
  }>> {
    const rows = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { invoices: true },
    });
    return rows.map((row) => {
      const base = toOrderRecord(row);
      const finalInv = row.invoices?.find((i) => i.type === PrismaInvoiceType.FINAL);
      const ackInv = row.invoices?.find((i) => i.type === PrismaInvoiceType.ACKNOWLEDGEMENT);
      const finalIssued = finalInv && (finalInv as { issuedAt?: Date | null }).issuedAt;
      const amountToPayPaise =
        finalIssued && finalInv ? finalInv.total : ackInv ? ackInv.total : null;
      const invForUsage = finalIssued && finalInv ? finalInv : ackInv;
      const subscriptionUsageKg =
        invForUsage && invForUsage.subscriptionUsageKg != null
          ? Number(invForUsage.subscriptionUsageKg)
          : null;
      const subscriptionUsageItems =
        invForUsage && invForUsage.subscriptionUsageItems != null
          ? invForUsage.subscriptionUsageItems
          : null;
      return {
        ...base,
        amountToPayPaise,
        subscriptionUsageKg,
        subscriptionUsageItems,
      };
    });
  }

  async countByUserCreatedBefore(userId: string, createdAt: Date): Promise<number> {
    return this.prisma.order.count({
      where: {
        userId,
        createdAt: { lte: createdAt },
      },
    });
  }

  async getOrderCountsByUserIds(userIds: string[]): Promise<Record<string, { past: number; active: number }>> {
    const out: Record<string, { past: number; active: number }> = {};
    userIds.forEach((id) => { out[id] = { past: 0, active: 0 }; });
    if (userIds.length === 0) return out;
    const [pastRows, activeRows] = await Promise.all([
      (this.prisma as PrismaClient).order.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, status: { in: [PrismaOrderStatus.DELIVERED, PrismaOrderStatus.CANCELLED] } },
        _count: { id: true },
      }),
      (this.prisma as PrismaClient).order.groupBy({
        by: ['userId'],
        where: {
          userId: { in: userIds },
          status: { notIn: [PrismaOrderStatus.DELIVERED, PrismaOrderStatus.CANCELLED] },
        },
        _count: { id: true },
      }),
    ]);
    pastRows.forEach((r) => { out[r.userId] = out[r.userId] ?? { past: 0, active: 0 }; out[r.userId].past = r._count.id; });
    activeRows.forEach((r) => { out[r.userId] = out[r.userId] ?? { past: 0, active: 0 }; out[r.userId].active = r._count.id; });
    return out;
  }

  async updatePaymentStatus(orderId: string, paymentStatus: string): Promise<OrderRecord> {
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: paymentStatus as PrismaPaymentStatus },
    });
    return toOrderRecord(order);
  }

  async updateSubscriptionId(orderId: string, subscriptionId: string): Promise<OrderRecord> {
    const order = await this.prisma.order.update({
      where: { id: orderId },
      data: { subscriptionId },
    });
    return toOrderRecord(order);
  }

  async adminList(filters: AdminOrdersFilters): Promise<AdminOrdersResult> {
    const andConditions: Array<Record<string, unknown>> = [];
    if (filters.status != null) andConditions.push({ status: filters.status });
    if (filters.pincode != null) andConditions.push({ pincode: filters.pincode });
    if (filters.serviceType != null) andConditions.push({ serviceType: filters.serviceType });
    if (filters.customerId != null) andConditions.push({ userId: filters.customerId });
    if (filters.orderSource != null) andConditions.push({ orderSource: filters.orderSource });
    if (filters.branchId != null) {
      // Include orders that have this branchId, OR orders with no branchId but whose pincode is in this branch's service area (so Branch name column shows this branch)
      const serviceAreas = await this.prisma.serviceArea.findMany({
        where: { branchId: filters.branchId!, active: true },
        select: { pincode: true },
      });
      const pincodesForBranch = serviceAreas.map((sa) => sa.pincode);
      if (pincodesForBranch.length > 0) {
        andConditions.push({
          OR: [
            { branchId: filters.branchId },
            { branchId: null, pincode: { in: pincodesForBranch } },
          ],
        });
      } else {
        andConditions.push({ branchId: filters.branchId });
      }
    }
    if (filters.pickupDateFrom != null && filters.pickupDateTo != null) {
      andConditions.push({
        pickupDate: { gte: filters.pickupDateFrom, lte: filters.pickupDateTo },
      });
    } else     if (filters.dateFrom != null || filters.dateTo != null) {
      const from = filters.dateFrom ?? new Date(0);
      const to = filters.dateTo ?? new Date(8640000000000000);
      const toEnd = new Date(to);
      toEnd.setHours(23, 59, 59, 999);
      andConditions.push({
        OR: [
          { createdAt: { gte: from, lte: toEnd } },
          { pickupDate: { gte: from, lte: toEnd } },
          { status: PrismaOrderStatus.DELIVERED, updatedAt: { gte: from, lte: toEnd } },
        ],
      });
    }
    const q = filters.search?.trim();
    if (q) {
      const digitsOnly = q.replace(/\D/g, '');
      const searchOr: Array<Record<string, unknown>> = [
        { id: { contains: q, mode: 'insensitive' as const } },
        { user: { name: { contains: q, mode: 'insensitive' as const } } },
        { user: { phone: { contains: q, mode: 'insensitive' as const } } },
      ];
      if (digitsOnly.length >= 3 && digitsOnly !== q) {
        searchOr.push({ user: { phone: { contains: digitsOnly, mode: 'insensitive' as const } } });
      }
      andConditions.push({ OR: searchOr });
    }
    const where = andConditions.length > 0 ? { AND: andConditions } : {};
    const take = filters.limit + 1;
    const orderBy = filters.pickupDateFrom != null && filters.pickupDateTo != null
      ? { pickupDate: 'asc' as const }
      : { createdAt: 'desc' as const };
    const rows = await (this.prisma as PrismaClient).order.findMany({
      where,
      orderBy,
      take,
      cursor: filters.cursor ? { id: filters.cursor } : undefined,
      skip: filters.cursor ? 1 : 0,
      include: {
        user: true,
        address: true,
        branch: true,
        invoices: true,
        payment: true,
      },
    });
    const slice = rows.slice(0, filters.limit);
    const pincodesToResolve = [
      ...new Set(
        slice
          .filter((row) => !row.branch && (row.pincode || row.address?.pincode))
          .map((row) => row.pincode || row.address?.pincode!)
      ),
    ];
    let pincodeToBranchName = new Map<string, string | null>();
    if (pincodesToResolve.length > 0) {
      const serviceAreas = await (this.prisma as PrismaClient).serviceArea.findMany({
        where: { pincode: { in: pincodesToResolve }, active: true },
        include: { branch: true },
      });
      for (const sa of serviceAreas) {
        pincodeToBranchName.set(sa.pincode, sa.branch?.name ?? null);
      }
    }
    const data = slice.map((row) => {
      const pincode = row.pincode || (row.address && row.address.pincode) || '';
      const resolvedBranchName = !row.branch ? (pincodeToBranchName.get(pincode) || null) : null;
      return this.toAdminOrderListRow(row, resolvedBranchName);
    });
    const nextCursor = rows.length > filters.limit ? rows[filters.limit - 1].id : null;
    return { data, nextCursor };
  }

  private toAdminOrderListRow(
    row: {
      id: string;
      userId: string;
      orderType: string;
      orderSource?: string | null;
      serviceType: string;
      serviceTypes?: string[];
      addressId: string;
      pincode: string;
      pickupDate: Date;
      timeWindow: string;
      estimatedWeightKg: unknown;
      actualWeightKg: unknown;
      status: string;
      subscriptionId: string | null;
      paymentStatus: string;
      createdAt: Date;
      updatedAt: Date;
      confirmedAt?: Date | null;
      pickedUpAt?: Date | null;
      inProgressAt?: Date | null;
      readyAt?: Date | null;
      outForDeliveryAt?: Date | null;
      deliveredAt?: Date | null;
      cancellationReason?: string | null;
      cancelledAt?: Date | null;
      user?: { name: string | null };
      address?: { addressLine: string; pincode: string };
      branch?: { name: string } | null;
      invoices?: Array<{ type: string; total: number; orderMode?: string; issuedAt?: Date | null }>;
      payment?: { status: string; failureReason?: string | null } | null;
    },
    resolvedBranchNameFromPincode?: string | null
  ): AdminOrderListRow {
    const base = toOrderRecord(row);
    const customerName = row.user?.name ?? null;
    const customerAddress =
      row.orderSource === 'WALK_IN'
        ? 'Walk-in'
        : [row.address?.addressLine, row.address?.pincode].filter(Boolean).join(', ') || '—';
    const branchName = row.branch?.name ?? resolvedBranchNameFromPincode ?? null;
    const deliveredDate =
      row.status === PrismaOrderStatus.DELIVERED
        ? (row.deliveredAt ?? row.updatedAt)
        : null;
    const finalInv = row.invoices?.find((i) => i.type === PrismaInvoiceType.FINAL);
    const ackInv = row.invoices?.find((i) => i.type === PrismaInvoiceType.ACKNOWLEDGEMENT);
    const finalIssued = finalInv && (finalInv as { status?: string; issuedAt?: Date | null }).issuedAt;
    let billTotalPaise: number | null = null;
    let billSubtotalPaise: number | null = null;
    let billTaxPaise: number | null = null;
    let billDiscountPaise: number | null = null;
    const selectedInv =
      finalIssued && finalInv ? finalInv
        : ackInv ? ackInv
          : null;

    if (selectedInv) {
      const s = selectedInv as unknown as {
        total: number;
        subtotal?: number | null;
        tax?: number | null;
        discountPaise?: number | null;
      };
      billTotalPaise = s.total;
      billSubtotalPaise = s.subtotal != null ? s.subtotal : null;
      billTaxPaise = s.tax != null ? s.tax : null;
      billDiscountPaise = s.discountPaise != null ? s.discountPaise ?? 0 : null;
    }
    const ackTotal = ackInv?.total ?? 0;
    const ackMode = (ackInv as { orderMode?: string } | undefined)?.orderMode;
    let billTypeLabel = '—';
    if (row.orderSource === 'WALK_IN') {
      billTypeLabel = 'Walkin';
    } else if (row.orderSource === 'ONLINE') {
      billTypeLabel = 'Online';
    } else if (ackInv) {
      if (ackTotal === 0) billTypeLabel = 'Zero';
      else if (ackMode === 'SUBSCRIPTION_ONLY') billTypeLabel = 'Subscription';
      else if (ackMode === 'BOTH') billTypeLabel = 'Both';
      else billTypeLabel = 'Individual';
    }
    const ackIssuedAt = ackInv && 'issuedAt' in ackInv ? (ackInv.issuedAt ?? null) : null;
    const finalIssuedAt = finalInv && 'issuedAt' in finalInv ? (finalInv.issuedAt ?? null) : null;
    const paymentFailureReason =
      row.payment?.status === 'FAILED' && row.payment?.failureReason
        ? row.payment.failureReason
        : null;
    return {
      ...base,
      customerName,
      customerAddress,
      branchName,
      deliveredDate,
      billTotalPaise,
      billSubtotalPaise,
      billTaxPaise,
      billDiscountPaise,
      billTypeLabel,
      ackIssuedAt: ackIssuedAt ?? null,
      finalIssuedAt: finalIssuedAt ?? null,
      paymentFailureReason,
    };
  }

  async getAdminSummary(orderId: string): Promise<OrderAdminSummary | null> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        address: true,
        branch: true,
        orderItems: { include: { laundryItem: true } },
        subscription: { include: { plan: true } },
        subscriptionUsages: true,
        invoices: { include: { items: true } },
        payment: true,
      },
    });
    if (!order) return null;

    const customer = order.user;
    const address = order.address;
    const orderWithSnapshot = order as { addressLabel?: string | null; addressLine?: string | null };
    const pincode = order.pincode || address?.pincode;
    let branchForSummary: { id: string; name: string; address: string; phone: string | null; gstNumber: string | null; panNumber: string | null; footerNote: string | null } | null = order.branch
      ? {
          id: order.branch.id,
          name: order.branch.name,
          address: order.branch.address,
          phone: order.branch.phone ?? null,
          gstNumber: order.branch.gstNumber ?? null,
          panNumber: order.branch.panNumber ?? null,
          footerNote: order.branch.footerNote ?? null,
        }
      : null;
    if (!branchForSummary && pincode) {
      const serviceArea = await this.prisma.serviceArea.findFirst({
        where: { pincode, active: true },
        include: { branch: true },
      });
      if (serviceArea?.branch) {
        branchForSummary = {
          id: serviceArea.branch.id,
          name: serviceArea.branch.name,
          address: serviceArea.branch.address,
          phone: serviceArea.branch.phone ?? null,
          gstNumber: serviceArea.branch.gstNumber ?? null,
          panNumber: serviceArea.branch.panNumber ?? null,
          footerNote: serviceArea.branch.footerNote ?? null,
        };
      }
    }

    // Resolve Segment/Service labels for invoice line items shown in analytics.
    const segmentIds = new Set<string>();
    const serviceIds = new Set<string>();
    for (const inv of order.invoices) {
      for (const it of inv.items ?? []) {
        if (it.segmentCategoryId) segmentIds.add(it.segmentCategoryId);
        if (it.serviceCategoryId) serviceIds.add(it.serviceCategoryId);
      }
    }
    const [segmentRows, serviceRows] = await Promise.all([
      segmentIds.size > 0
        ? this.prisma.segmentCategory.findMany({
            where: { id: { in: Array.from(segmentIds) } },
            select: { id: true, label: true },
          })
        : Promise.resolve([] as Array<{ id: string; label: string }>),
      serviceIds.size > 0
        ? this.prisma.serviceCategory.findMany({
            where: { id: { in: Array.from(serviceIds) } },
            select: { id: true, label: true },
          })
        : Promise.resolve([] as Array<{ id: string; label: string }>),
    ]);
    const segmentLabelById = new Map<string, string>(
      segmentRows.map((r: { id: string; label: string }) => [r.id, r.label]),
    );
    const serviceLabelById = new Map<string, string>(
      serviceRows.map((r: { id: string; label: string }) => [r.id, r.label]),
    );

    const summary: OrderAdminSummary = {
      order: toOrderRecord(order),
      customer: {
        id: customer.id,
        name: customer.name ?? null,
        phone: customer.phone ?? null,
        email: customer.email ?? null,
      },
      address: {
        id: order.addressId,
        label: address ? address.label : (orderWithSnapshot.addressLabel ?? ''),
        addressLine: address ? address.addressLine : (orderWithSnapshot.addressLine ?? ''),
        pincode: address ? address.pincode : (order.pincode ?? ''),
        googleMapUrl: address ? (address as { googleMapUrl?: string | null }).googleMapUrl ?? null : null,
      },
      branch: branchForSummary,
      orderItems: order.orderItems.map((oi) => ({
        id: oi.id,
        name: oi.laundryItem?.name,
        serviceType: oi.serviceType,
        quantity: Number(oi.quantity),
        estimatedWeightKg: oi.estimatedWeightKg != null ? Number(oi.estimatedWeightKg) : null,
        actualWeightKg: oi.actualWeightKg != null ? Number(oi.actualWeightKg) : null,
        unitPricePaise: oi.unitPricePaise ?? null,
        amountPaise: oi.amountPaise ?? null,
      })),
      subscription: order.subscription
        ? {
            id: order.subscription.id,
            planName: order.subscription.plan.name,
            remainingPickups: order.subscription.remainingPickups,
            maxPickups: order.subscription.totalMaxPickups ?? order.subscription.plan.maxPickups,
            usedKg: Number(order.subscription.usedKg),
            usedItemsCount: order.subscription.usedItemsCount,
            kgLimit: order.subscription.plan.kgLimit != null ? Number(order.subscription.plan.kgLimit) : null,
            itemsLimit: order.subscription.plan.itemsLimit ?? null,
            expiryDate: order.subscription.expiryDate,
            active: order.subscription.active,
          }
        : null,
      activeSubscriptions: await (async () => {
        const list = await this.prisma.subscription.findMany({
          where: { userId: order.userId, active: true },
          include: { plan: true },
        });
        const now = new Date();
        return list
          .filter((s) => s.expiryDate >= now)
          .map((s) => ({
            id: s.id,
            planName: s.plan.name,
            remainingPickups: s.remainingPickups,
            maxPickups: s.totalMaxPickups ?? s.plan.maxPickups,
            usedKg: Number(s.usedKg),
            usedItemsCount: s.usedItemsCount,
            kgLimit: s.plan.kgLimit != null ? Number(s.plan.kgLimit) : null,
            itemsLimit: s.plan.itemsLimit ?? null,
            expiryDate: s.expiryDate,
          }));
      })(),
      subscriptionUsage: order.subscriptionUsages?.length
        ? {
            deductedPickups: order.subscriptionUsages[0].deductedPickups,
            deductedKg: Number(order.subscriptionUsages[0].deductedKg),
            deductedItemsCount: order.subscriptionUsages[0].deductedItemsCount,
          }
        : null,
      invoices: order.invoices.map((inv) => ({
        id: inv.id,
        type: inv.type,
        status: inv.status,
        code: inv.code ?? null,
        subtotal: inv.subtotal,
        tax: inv.tax,
        discountPaise: inv.discountPaise ?? null,
        total: inv.total,
        orderMode: inv.orderMode ?? undefined,
        comments: inv.comments ?? null,
        issuedAt: inv.issuedAt,
        pdfUrl: inv.pdfUrl,
        subscriptionUsageKg: (inv as { subscriptionUsageKg?: unknown }).subscriptionUsageKg != null ? Number((inv as { subscriptionUsageKg: unknown }).subscriptionUsageKg) : null,
        subscriptionUsageItems: (inv as { subscriptionUsageItems?: number | null }).subscriptionUsageItems ?? null,
        newSubscriptionSnapshotJson: (inv as { newSubscriptionSnapshotJson?: unknown }).newSubscriptionSnapshotJson ?? undefined,
        brandingSnapshotJson: (inv as { brandingSnapshotJson?: unknown }).brandingSnapshotJson ?? undefined,
        items: (inv as { items?: Array<{ type: string; name: string; quantity: unknown; unitPrice: number; amount: number; catalogItemId?: string | null; segmentCategoryId?: string | null; serviceCategoryId?: string | null }> }).items?.map((i) => ({
          type: i.type,
          name: i.name,
          quantity: Number(i.quantity),
          unitPrice: i.unitPrice,
          amount: i.amount,
          ...(i.catalogItemId != null && { catalogItemId: i.catalogItemId }),
          ...(i.segmentCategoryId != null && { segmentCategoryId: i.segmentCategoryId }),
          ...(i.serviceCategoryId != null && { serviceCategoryId: i.serviceCategoryId }),
          segmentLabel: i.segmentCategoryId ? (segmentLabelById.get(i.segmentCategoryId) ?? null) : null,
          serviceLabel: i.serviceCategoryId ? (serviceLabelById.get(i.serviceCategoryId) ?? null) : null,
        })),
      })),
      payment: order.payment
        ? {
            id: order.payment.id,
            provider: order.payment.provider,
            status: order.payment.status,
            amount: order.payment.amount,
            note: order.payment.failureReason ?? null,
          }
        : null,
    };
    return summary;
  }
}
