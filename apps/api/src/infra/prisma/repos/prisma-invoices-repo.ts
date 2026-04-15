import {
  type PrismaClient,
  type Prisma,
  InvoiceStatus as PrismaInvoiceStatus,
  InvoiceType as PrismaInvoiceType,
} from '@prisma/client';
import type {
  AdminFinalInvoiceFilters,
  AdminFinalInvoiceRow,
  AdminFinalInvoicesResult,
  AdminSubscriptionInvoiceFilters,
  AdminSubscriptionInvoiceRow,
  AdminSubscriptionInvoicesResult,
  CreateDraftInput,
  CreateSubscriptionInvoiceInput,
  InvoiceRecord,
  InvoicesRepo,
  UpdateDraftInput,
  UpdateInvoiceContentInput,
} from '../../../application/ports';
import type { InvoiceType } from '@shared/enums';
import { indiaDayUtcRange } from '../../../application/time/india-date';

type PrismaLike = Pick<PrismaClient, 'invoice'>;

function toInvoiceRecord(row: {
  id: string;
  orderId: string | null;
  subscriptionId: string | null;
  code: string | null;
  type: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  discountPaise: number | null;
  issuedAt: Date | null;
  pdfUrl: string | null;
  brandingSnapshotJson: unknown;
  createdAt: Date;
  updatedAt: Date;
  orderMode?: string;
  subscriptionUtilized?: boolean;
  subscriptionUsageKg?: unknown;
  subscriptionUsageItems?: number | null;
  paymentStatus?: string;
  paymentOverrideReason?: string | null;
  comments?: string | null;
  subscriptionUsagesJson?: unknown;
  newSubscriptionSnapshotJson?: unknown;
  newSubscriptionFulfilledAt?: Date | null;
  subscriptionPurchaseSnapshotJson?: unknown;
  items?: Array<{
    id: string;
    type: string;
    name: string;
    quantity: unknown;
    unitPrice: number;
    amount: number;
    catalogItemId?: string | null;
    segmentCategoryId?: string | null;
    serviceCategoryId?: string | null;
  }>;
}): InvoiceRecord {
  return {
    id: row.id,
    orderId: row.orderId ?? null,
    subscriptionId: row.subscriptionId ?? null,
    code: row.code ?? null,
    type: row.type as InvoiceRecord['type'],
    status: row.status as InvoiceRecord['status'],
    subtotal: row.subtotal,
    tax: row.tax,
    total: row.total,
    discountPaise: row.discountPaise,
    issuedAt: row.issuedAt,
    pdfUrl: row.pdfUrl,
    brandingSnapshotJson: row.brandingSnapshotJson,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    orderMode: row.orderMode ?? 'INDIVIDUAL',
    subscriptionUtilized: row.subscriptionUtilized ?? false,
    subscriptionUsageKg: row.subscriptionUsageKg != null ? Number(row.subscriptionUsageKg) : null,
    subscriptionUsageItems: row.subscriptionUsageItems ?? null,
    subscriptionUsagesJson: (row as { subscriptionUsagesJson?: unknown }).subscriptionUsagesJson ?? undefined,
    paymentStatus: row.paymentStatus ?? 'DUE',
    paymentOverrideReason: row.paymentOverrideReason ?? null,
    comments: row.comments ?? null,
    newSubscriptionSnapshotJson: (row as { newSubscriptionSnapshotJson?: unknown }).newSubscriptionSnapshotJson ?? undefined,
    newSubscriptionFulfilledAt: (row as { newSubscriptionFulfilledAt?: Date | null }).newSubscriptionFulfilledAt ?? null,
    subscriptionPurchaseSnapshotJson: (row as { subscriptionPurchaseSnapshotJson?: unknown }).subscriptionPurchaseSnapshotJson ?? undefined,
    items: row.items?.map((i) => ({
      id: i.id,
      type: i.type,
      name: i.name,
      quantity: Number(i.quantity),
      unitPrice: i.unitPrice,
      amount: i.amount,
      catalogItemId: i.catalogItemId ?? undefined,
      segmentCategoryId: i.segmentCategoryId ?? undefined,
      serviceCategoryId: i.serviceCategoryId ?? undefined,
    })),
  };
}

export class PrismaInvoicesRepo implements InvoicesRepo {
  constructor(private readonly prisma: PrismaLike) {}

  async getById(invoiceId: string): Promise<InvoiceRecord | null> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true },
    });
    return invoice ? toInvoiceRecord(invoice) : null;
  }

  async getByOrderId(orderId: string): Promise<InvoiceRecord | null> {
    const invoice = await this.prisma.invoice.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    return invoice ? toInvoiceRecord(invoice) : null;
  }

  async getByOrderIdAndType(orderId: string, type: InvoiceType): Promise<InvoiceRecord | null> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { orderId_type: { orderId: orderId!, type: type as PrismaInvoiceType } },
      include: { items: true },
    });
    return invoice ? toInvoiceRecord(invoice) : null;
  }

  async getBySubscriptionIdAndType(subscriptionId: string, type: InvoiceType): Promise<InvoiceRecord | null> {
    const invoice = await (this.prisma as PrismaClient).invoice.findFirst({
      where: { subscriptionId, type: type as PrismaInvoiceType },
      include: { items: true },
    });
    return invoice ? toInvoiceRecord(invoice) : null;
  }

  async findByOrderId(orderId: string): Promise<InvoiceRecord[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
      include: { items: true },
    });
    return invoices.map(toInvoiceRecord);
  }

  async createDraft(input: CreateDraftInput): Promise<InvoiceRecord> {
    const invoice = await this.prisma.invoice.create({
      data: {
        orderId: input.orderId,
        type: input.type as PrismaInvoiceType,
        status: PrismaInvoiceStatus.DRAFT,
        code: input.code ?? undefined,
        subtotal: input.subtotal,
        tax: input.tax,
        total: input.total,
        discountPaise: input.discountPaise ?? undefined,
        brandingSnapshotJson: input.brandingSnapshotJson ?? undefined,
        ...(input.orderMode !== undefined && { orderMode: input.orderMode as 'INDIVIDUAL' | 'SUBSCRIPTION_ONLY' | 'BOTH' }),
        ...(input.subscriptionUtilized !== undefined && { subscriptionUtilized: input.subscriptionUtilized }),
        ...(input.subscriptionId !== undefined && { subscriptionId: input.subscriptionId }),
        ...(input.subscriptionUsageKg !== undefined && { subscriptionUsageKg: input.subscriptionUsageKg }),
        ...(input.subscriptionUsageItems !== undefined && { subscriptionUsageItems: input.subscriptionUsageItems }),
        ...(input.subscriptionUsagesJson !== undefined && { subscriptionUsagesJson: input.subscriptionUsagesJson as object }),
        ...(input.paymentStatus !== undefined && { paymentStatus: input.paymentStatus }),
        ...(input.comments !== undefined && { comments: input.comments }),
        ...(input.newSubscriptionSnapshotJson !== undefined && { newSubscriptionSnapshotJson: input.newSubscriptionSnapshotJson as object }),
        items: {
          create: input.items.map((item) => ({
            type: item.type as import('@prisma/client').InvoiceItemType,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            amount: item.amount,
            ...(item.catalogItemId != null && { catalogItemId: item.catalogItemId }),
            ...(item.segmentCategoryId != null && { segmentCategoryId: item.segmentCategoryId }),
            ...(item.serviceCategoryId != null && { serviceCategoryId: item.serviceCategoryId }),
          })),
        },
      } as Parameters<PrismaLike['invoice']['create']>[0]['data'],
      include: { items: true },
    });
    return toInvoiceRecord(invoice);
  }

  async createSubscriptionInvoice(input: CreateSubscriptionInvoiceInput): Promise<InvoiceRecord> {
    const now = new Date();
    const invoice = await (this.prisma as PrismaClient).invoice.create({
      data: {
        subscriptionId: input.subscriptionId,
        type: PrismaInvoiceType.SUBSCRIPTION,
        status: PrismaInvoiceStatus.ISSUED,
        issuedAt: now,
        subtotal: input.totalPaise,
        tax: 0,
        total: input.totalPaise,
        discountPaise: 0,
        paymentStatus: input.totalPaise > 0 ? 'DUE' : 'PAID',
        code: input.code ?? null,
        brandingSnapshotJson: (input.brandingSnapshotJson ?? undefined) as Prisma.InputJsonValue | undefined,
        subscriptionPurchaseSnapshotJson: input.subscriptionPurchaseSnapshot
          ? (input.subscriptionPurchaseSnapshot as unknown as Prisma.InputJsonValue)
          : undefined,
        items: {
          create: [
            {
              type: 'SERVICE' as const,
              name: input.planName,
              quantity: 1,
              unitPrice: input.totalPaise,
              amount: input.totalPaise,
            },
          ],
        },
      },
      include: { items: true },
    });
    return toInvoiceRecord(invoice);
  }

  async updateDraft(invoiceId: string, input: UpdateDraftInput): Promise<InvoiceRecord> {
    const existing = await this.getById(invoiceId);
    if (!existing || existing.status !== 'DRAFT') {
      throw new Error('Cannot update: invoice not found or not in DRAFT status');
    }
    return this.updateInvoiceContent(invoiceId, input);
  }

  async updateInvoiceContent(invoiceId: string, input: UpdateInvoiceContentInput): Promise<InvoiceRecord> {
    const data: Parameters<PrismaLike['invoice']['update']>[0]['data'] = {
      subtotal: input.subtotal,
      tax: input.tax,
      total: input.total,
      discountPaise: input.discountPaise ?? undefined,
      ...(input.comments !== undefined && { comments: input.comments }),
      ...(input.orderMode !== undefined && { orderMode: input.orderMode as 'INDIVIDUAL' | 'SUBSCRIPTION_ONLY' | 'BOTH' }),
      ...(input.subscriptionUtilized !== undefined && { subscriptionUtilized: input.subscriptionUtilized }),
      ...(input.subscriptionId !== undefined && { subscriptionId: input.subscriptionId }),
      ...(input.subscriptionUsageKg !== undefined && { subscriptionUsageKg: input.subscriptionUsageKg }),
      ...(input.subscriptionUsageItems !== undefined && { subscriptionUsageItems: input.subscriptionUsageItems }),
      ...(input.subscriptionUsagesJson !== undefined && { subscriptionUsagesJson: input.subscriptionUsagesJson as object }),
      ...(input.newSubscriptionSnapshotJson !== undefined && { newSubscriptionSnapshotJson: input.newSubscriptionSnapshotJson as object }),
      items: {
        deleteMany: {},
        create: input.items.map((item) => ({
          type: item.type as import('@prisma/client').InvoiceItemType,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          ...(item.catalogItemId != null && { catalogItemId: item.catalogItemId }),
          ...(item.segmentCategoryId != null && { segmentCategoryId: item.segmentCategoryId }),
          ...(item.serviceCategoryId != null && { serviceCategoryId: item.serviceCategoryId }),
        })),
      },
    };
    const invoice = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data,
      include: { items: true },
    });
    return toInvoiceRecord(invoice);
  }

  async setIssued(invoiceId: string, issuedAt: Date): Promise<InvoiceRecord> {
    const invoice = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: PrismaInvoiceStatus.ISSUED, issuedAt },
      include: { items: true },
    });
    return toInvoiceRecord(invoice);
  }

  async setStatus(invoiceId: string, status: InvoiceRecord['status']): Promise<void> {
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: status as PrismaInvoiceStatus },
    });
  }

  async void(invoiceId: string): Promise<void> {
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: PrismaInvoiceStatus.VOID },
    });
  }

  async updatePdfUrl(invoiceId: string, pdfUrl: string): Promise<void> {
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { pdfUrl },
    });
  }

  async updateSubscriptionAndPayment(
    invoiceId: string,
    data: {
      subscriptionUtilized?: boolean;
      subscriptionId?: string | null;
      subscriptionUsageKg?: number | null;
      subscriptionUsageItems?: number | null;
      paymentStatus?: string;
      paymentOverrideReason?: string | null;
    },
  ): Promise<void> {
    const update: Record<string, unknown> = {};
    if (data.subscriptionUtilized !== undefined) update.subscriptionUtilized = data.subscriptionUtilized;
    if (data.subscriptionId !== undefined) update.subscriptionId = data.subscriptionId;
    if (data.subscriptionUsageKg !== undefined) update.subscriptionUsageKg = data.subscriptionUsageKg;
    if (data.subscriptionUsageItems !== undefined) update.subscriptionUsageItems = data.subscriptionUsageItems;
    if (data.paymentStatus !== undefined) update.paymentStatus = data.paymentStatus;
    if (data.paymentOverrideReason !== undefined) update.paymentOverrideReason = data.paymentOverrideReason;
    if (Object.keys(update).length === 0) return;
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: update as Record<string, never>,
    });
  }

  async setNewSubscriptionFulfilledAt(invoiceId: string, at: Date): Promise<void> {
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { newSubscriptionFulfilledAt: at },
    });
  }

  async listSubscriptionInvoices(filters: AdminSubscriptionInvoiceFilters): Promise<AdminSubscriptionInvoicesResult> {
    const prisma = this.prisma as PrismaClient;
    const where: {
      type: PrismaInvoiceType;
      subscription?: { userId?: string; branchId?: string | null };
      issuedAt?: { gte?: Date; lte?: Date };
    } = {
      type: PrismaInvoiceType.SUBSCRIPTION,
    };
    if (filters.customerId || filters.branchId != null) {
      where.subscription = {};
      if (filters.customerId) where.subscription.userId = filters.customerId;
      if (filters.branchId != null) where.subscription.branchId = filters.branchId;
    }
    if (filters.dateFrom && filters.dateTo) {
      where.issuedAt = { gte: filters.dateFrom, lte: filters.dateTo };
    } else if (filters.dateFrom) {
      where.issuedAt = { gte: filters.dateFrom };
    } else if (filters.dateTo) {
      where.issuedAt = { lte: filters.dateTo };
    }
    const take = filters.limit + 1;
    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
      take,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
      include: {
        items: true,
        subscription: { include: { user: true } },
      },
    });
    const hasMore = invoices.length > filters.limit;
    const rows = (hasMore ? invoices.slice(0, filters.limit) : invoices) as Array<{
      id: string;
      subscriptionId: string | null;
      code: string | null;
      total: number;
      issuedAt: Date | null;
      paymentStatus: string | null;
      items: Array<{ name: string }>;
      subscription: { userId: string; user: { name: string | null; phone: string | null } } | null;
    }>;
    const data: AdminSubscriptionInvoiceRow[] = rows.map((inv) => ({
      invoiceId: inv.id,
      subscriptionId: inv.subscriptionId!,
      code: inv.code,
      total: inv.total,
      issuedAt: inv.issuedAt,
      paymentStatus: inv.paymentStatus ?? 'DUE',
      customerId: inv.subscription!.userId,
      customerName: inv.subscription!.user.name ?? null,
      customerPhone: inv.subscription!.user.phone ?? null,
      planName: inv.items[0]?.name ?? 'Subscription',
    }));
    return {
      data,
      nextCursor: hasMore && rows.length > 0 ? rows[rows.length - 1].id : null,
    };
  }

  async listFinalInvoices(filters: AdminFinalInvoiceFilters): Promise<AdminFinalInvoicesResult> {
    const prisma = this.prisma as PrismaClient;
    const take = filters.limit + 1;
    const andParts: Record<string, unknown>[] = [
      { type: { in: [PrismaInvoiceType.FINAL, PrismaInvoiceType.SUBSCRIPTION] } },
    ];
    if (filters.customerId) {
      andParts.push({
        OR: [
          { order: { userId: filters.customerId } },
          { subscription: { userId: filters.customerId } },
        ],
      });
    }
    if (filters.branchId != null) {
      const serviceAreas = await prisma.serviceArea.findMany({
        where: { branchId: filters.branchId, active: true },
        select: { pincode: true },
      });
      const pincodesForBranch = serviceAreas.map((sa) => sa.pincode);
      if (pincodesForBranch.length > 0) {
        andParts.push({
          OR: [
            { orderId: { not: null }, order: { OR: [{ branchId: filters.branchId }, { branchId: null, pincode: { in: pincodesForBranch } }] } },
            { subscriptionId: { not: null }, subscription: { branchId: filters.branchId } },
          ],
        });
      } else {
        andParts.push({
          OR: [
            { orderId: { not: null }, order: { branchId: filters.branchId } },
            { subscriptionId: { not: null }, subscription: { branchId: filters.branchId } },
          ],
        });
      }
    }
    if (filters.dateFrom && filters.dateTo) {
      andParts.push({ issuedAt: { gte: filters.dateFrom, lte: filters.dateTo } });
    } else if (filters.dateFrom) {
      andParts.push({ issuedAt: { gte: filters.dateFrom } });
    } else if (filters.dateTo) {
      andParts.push({ issuedAt: { lte: filters.dateTo } });
    }
    const invoices = await prisma.invoice.findMany({
      where: andParts.length > 1 ? { AND: andParts } : andParts[0],
      orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
      take,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
      include: {
        items: true,
        order: { include: { user: true, payment: true, branch: true } },
        subscription: { include: { user: true, branch: true } },
      },
    });
    const hasMore = invoices.length > filters.limit;
    const rows = hasMore ? invoices.slice(0, filters.limit) : invoices;

    // Resolve branch name from ServiceArea (by pincode) for orders with no direct branch
    const pincodesToResolve = [
      ...new Set(
        rows
          .filter((inv) => inv.order && !inv.order.branch && inv.order.pincode)
          .map((inv) => inv.order!.pincode)
      ),
    ];
    let pincodeToBranchName = new Map<string, string | null>();
    if (pincodesToResolve.length > 0) {
      const serviceAreas = await prisma.serviceArea.findMany({
        where: { pincode: { in: pincodesToResolve }, active: true },
        include: { branch: true },
      });
      const byPincode = new Map<string, typeof serviceAreas>();
      for (const sa of serviceAreas) {
        const list = byPincode.get(sa.pincode) ?? [];
        list.push(sa);
        byPincode.set(sa.pincode, list);
      }
      for (const [pin, list] of byPincode) {
        const sorted = [...list].sort((a, b) => Number(b.branch.isDefault) - Number(a.branch.isDefault));
        pincodeToBranchName.set(pin, sorted[0]?.branch?.name ?? null);
      }
    }

    const data: AdminFinalInvoiceRow[] = rows.map((inv) => {
      const user = inv.order?.user ?? inv.subscription?.user;
      const invoicePaymentStatus = inv.paymentStatus ?? 'DUE';
      const orderPaid = inv.order?.payment?.status === 'CAPTURED' || inv.order?.paymentStatus === 'CAPTURED';
      const paymentStatus =
        invoicePaymentStatus === 'PAID' || orderPaid ? 'PAID' : invoicePaymentStatus;
      const orderBranchName =
        inv.order?.branch?.name ?? (inv.order?.pincode ? pincodeToBranchName.get(inv.order.pincode) ?? null : null);
      const subscriptionBranchName = inv.subscription?.branch?.name ?? null;
      const branchName = orderBranchName ?? subscriptionBranchName ?? null;
      return {
        invoiceId: inv.id,
        type: inv.type as 'FINAL' | 'SUBSCRIPTION',
        orderId: inv.orderId ?? null,
        subscriptionId: inv.subscriptionId ?? null,
        code: inv.code ?? null,
        total: inv.total,
        issuedAt: inv.issuedAt,
        paymentStatus,
        customerId: user?.id ?? '',
        customerName: user?.name ?? null,
        customerPhone: user?.phone ?? null,
        planName: inv.type === 'SUBSCRIPTION' ? (inv.items[0]?.name ?? null) : null,
        branchName,
        orderSource: inv.order?.orderSource ?? null,
      };
    });
    return {
      data,
      nextCursor: hasMore && rows.length > 0 ? rows[rows.length - 1].id : null,
    };
  }

  async countSubscriptionInvoicesIssuedOnDate(dateKey: string): Promise<number> {
    const { start, end } = indiaDayUtcRange(dateKey);
    const prisma = this.prisma as PrismaClient;
    return prisma.invoice.count({
      where: {
        type: PrismaInvoiceType.SUBSCRIPTION,
        issuedAt: { gte: start, lt: end },
      },
    });
  }
}
