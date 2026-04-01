import { type PrismaClient } from '@prisma/client';
import type {
  AnalyticsRepo,
  RevenueResult,
  RevenueBreakdownItem,
  CompletedCatalogItemQuantity,
} from '../../../application/ports';

type PrismaLike = PrismaClient;

/**
 * Revenue in date range: billed = FINAL+ISSUED invoices, collected = CAPTURED payments.
 */
export class PrismaAnalyticsRepo implements AnalyticsRepo {
  constructor(private readonly prisma: PrismaLike) {}

  async getRevenue(
    dateFrom: Date,
    dateTo: Date,
    breakdownKind: 'daily' | 'monthly',
    branchId?: string,
  ): Promise<RevenueResult> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        type: 'FINAL',
        status: 'ISSUED',
        issuedAt: { gte: dateFrom, lt: dateTo },
        ...(branchId ? { order: { branchId } } : {}),
      },
      select: { total: true, tax: true, discountPaise: true, issuedAt: true },
    });
    const payments = await this.prisma.payment.findMany({
      where: {
        status: 'CAPTURED',
        createdAt: { gte: dateFrom, lt: dateTo },
        ...(branchId ? { order: { branchId } } : {}),
      },
      select: { amount: true, createdAt: true },
    });
    const ordersInRange = await this.prisma.order.findMany({
      where: { createdAt: { gte: dateFrom, lt: dateTo }, ...(branchId ? { branchId } : {}) },
      select: { id: true, createdAt: true, status: true, orderSource: true, orderType: true },
    });

    const billedPaise = invoices.reduce((s, i) => s + i.total, 0);
    const collectedPaise = payments.reduce((s, p) => s + p.amount, 0);
    const taxPaise = invoices.reduce((s, i) => s + (i.tax ?? 0), 0);
    const discountPaise = invoices.reduce((s, i) => s + (i.discountPaise ?? 0), 0);

    const keyToBilled: Record<string, number> = {};
    const keyToCollected: Record<string, number> = {};
    const keyToOrders: Record<string, number> = {};
    const keyToInvoices: Record<string, number> = {};

    function getKey(d: Date): string {
      if (breakdownKind === 'monthly') {
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      }
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    }

    for (const inv of invoices) {
      const at = inv.issuedAt ?? new Date(0);
      const key = getKey(at);
      keyToBilled[key] = (keyToBilled[key] ?? 0) + inv.total;
      keyToInvoices[key] = (keyToInvoices[key] ?? 0) + 1;
    }
    for (const p of payments) {
      const key = getKey(p.createdAt);
      keyToCollected[key] = (keyToCollected[key] ?? 0) + p.amount;
    }
    for (const o of ordersInRange) {
      const key = getKey(o.createdAt);
      keyToOrders[key] = (keyToOrders[key] ?? 0) + 1;
    }

    // Partitioned order categories for pie-chart percentage accuracy.
    const cancelled = ordersInRange.filter((o) => o.status === 'CANCELLED').length;
    const subscription = ordersInRange.filter(
      (o) => o.status !== 'CANCELLED' && (o.orderType === 'SUBSCRIPTION' || o.orderType === 'BOTH'),
    ).length;
    const online = ordersInRange.filter(
      (o) =>
        o.status !== 'CANCELLED' &&
        !(o.orderType === 'SUBSCRIPTION' || o.orderType === 'BOTH') &&
        o.orderSource === 'ONLINE',
    ).length;
    const walkin = ordersInRange.filter(
      (o) =>
        o.status !== 'CANCELLED' &&
        !(o.orderType === 'SUBSCRIPTION' || o.orderType === 'BOTH') &&
        o.orderSource !== 'ONLINE',
    ).length;

    const allKeys = new Set([
      ...Object.keys(keyToBilled),
      ...Object.keys(keyToCollected),
      ...Object.keys(keyToOrders),
    ]);
    const breakdown: RevenueBreakdownItem[] = Array.from(allKeys)
      .sort()
      .map((key) => ({
        key,
        billedPaise: keyToBilled[key] ?? 0,
        collectedPaise: keyToCollected[key] ?? 0,
        ordersCount: keyToOrders[key] ?? 0,
        invoicesCount: keyToInvoices[key] ?? 0,
      }));

    return {
      billedPaise,
      collectedPaise,
      taxPaise,
      discountPaise,
      ordersCount: ordersInRange.length,
      invoicesCount: invoices.length,
      orderCategories: {
        online,
        walkin,
        subscription,
        cancelled,
      },
      breakdown,
    };
  }

  async getCompletedCatalogItemQuantities(
    dateFrom: Date,
    dateTo: Date,
    branchId?: string,
  ): Promise<CompletedCatalogItemQuantity[]> {
    const invoices = await this.prisma.invoice.findMany({
      where: {
        type: 'FINAL',
        status: 'ISSUED',
        issuedAt: { gte: dateFrom, lt: dateTo },
        order: {
          status: 'DELIVERED',
          ...(branchId ? { branchId } : {}),
        },
      },
      select: {
        items: true,
      },
    });

    const allItems = invoices.flatMap((inv) => (inv as { items?: Array<{
      name?: string;
      quantity?: number;
      segmentLabel?: string | null;
      serviceLabel?: string | null;
      segmentCategoryId?: string | null;
      serviceCategoryId?: string | null;
      catalogItemId?: string | null;
    }> }).items ?? []);

    const segmentIds = Array.from(
      new Set(
        allItems
          .map((i) => i.segmentCategoryId)
          .filter((v): v is string => !!v),
      ),
    );
    const serviceIds = Array.from(
      new Set(
        allItems
          .map((i) => i.serviceCategoryId)
          .filter((v): v is string => !!v),
      ),
    );

    const [segmentRows, serviceRows] = await Promise.all([
      segmentIds.length
        ? this.prisma.segmentCategory.findMany({
            where: { id: { in: segmentIds } },
            select: { id: true, label: true },
          })
        : Promise.resolve([] as Array<{ id: string; label: string }>),
      serviceIds.length
        ? this.prisma.serviceCategory.findMany({
            where: { id: { in: serviceIds } },
            select: { id: true, label: true },
          })
        : Promise.resolve([] as Array<{ id: string; label: string }>),
    ]);

    const segmentLabelById = new Map(segmentRows.map((r) => [r.id, r.label]));
    const serviceLabelById = new Map(serviceRows.map((r) => [r.id, r.label]));

    const agg = new Map<string, CompletedCatalogItemQuantity>();
    for (const inv of invoices) {
      const items = (inv as { items?: Array<{
        name?: string;
        quantity?: number;
        segmentLabel?: string | null;
        serviceLabel?: string | null;
        segmentCategoryId?: string | null;
        serviceCategoryId?: string | null;
        catalogItemId?: string | null;
      }> }).items ?? [];
      for (const item of items) {
        if (!item?.name) continue;
        const qty = Number(item.quantity ?? 0);
        if (!Number.isFinite(qty) || qty <= 0) continue;
        const resolvedSegment =
          (item.segmentLabel ?? '').trim()
          || (item.segmentCategoryId ? (segmentLabelById.get(item.segmentCategoryId) ?? '').trim() : '');
        const resolvedService =
          (item.serviceLabel ?? '').trim()
          || (item.serviceCategoryId ? (serviceLabelById.get(item.serviceCategoryId) ?? '').trim() : '');
        const segment = resolvedSegment || '—';
        const service = resolvedService || '—';
        const key = `${item.name}__${segment}__${service}`;
        const prev = agg.get(key);
        if (prev) {
          prev.quantity += qty;
        } else {
          agg.set(key, {
            itemName: item.name,
            segment,
            service,
            quantity: qty,
          });
        }
      }
    }

    return Array.from(agg.values()).sort((a, b) => {
      if (b.quantity !== a.quantity) return b.quantity - a.quantity;
      if (a.itemName !== b.itemName) return a.itemName.localeCompare(b.itemName);
      if (a.segment !== b.segment) return a.segment.localeCompare(b.segment);
      return a.service.localeCompare(b.service);
    });
  }
}
