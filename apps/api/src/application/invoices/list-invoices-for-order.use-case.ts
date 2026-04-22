import { AppError } from '../errors';
import type {
  OrdersRepo,
  InvoicesRepo,
  LaundryItemsRepo,
  SegmentCategoryRepo,
  ServiceCategoryRepo,
} from '../ports';

export interface ListInvoicesForOrderDeps {
  ordersRepo: OrdersRepo;
  invoicesRepo: InvoicesRepo;
  laundryItemsRepo?: LaundryItemsRepo;
  segmentCategoryRepo?: SegmentCategoryRepo;
  serviceCategoryRepo?: ServiceCategoryRepo;
}

/**
 * Returns invoices for an order. Caller must be the order owner (userId).
 * Throws ORDER_NOT_FOUND or ORDER_ACCESS_DENIED.
 * When laundryItemsRepo is provided, each item with catalogItemId gets its icon from the catalog.
 */
export async function listInvoicesForOrder(
  orderId: string,
  userId: string,
  deps: ListInvoicesForOrderDeps,
) {
  const order = await deps.ordersRepo.getById(orderId);
  if (!order) {
    throw new AppError('ORDER_NOT_FOUND', 'Order not found', { orderId });
  }
  if (order.userId !== userId) {
    throw new AppError('ORDER_ACCESS_DENIED', 'Not allowed to view this order');
  }
  const invoices = await deps.invoicesRepo.findByOrderId(orderId);
  const catalogItemIds = new Set<string>();
  const segmentCategoryIds = new Set<string>();
  const serviceCategoryIds = new Set<string>();
  for (const inv of invoices) {
    for (const item of inv.items ?? []) {
      if (item.catalogItemId) catalogItemIds.add(item.catalogItemId);
      if (item.segmentCategoryId) segmentCategoryIds.add(item.segmentCategoryId);
      if (item.serviceCategoryId) serviceCategoryIds.add(item.serviceCategoryId);
    }
  }
  const iconMap: Record<string, string | null> = {};
  if (deps.laundryItemsRepo && catalogItemIds.size > 0) {
    for (const id of catalogItemIds) {
      const catalogItem = await deps.laundryItemsRepo.getById(id);
      iconMap[id] = catalogItem?.icon ?? null;
    }
  }

  const segmentLabelMap: Record<string, string | null> = {};
  if (deps.segmentCategoryRepo && segmentCategoryIds.size > 0) {
    for (const id of segmentCategoryIds) {
      const seg = await deps.segmentCategoryRepo.getById(id);
      segmentLabelMap[id] = seg?.label ?? null;
    }
  }

  const serviceLabelMap: Record<string, string | null> = {};
  if (deps.serviceCategoryRepo && serviceCategoryIds.size > 0) {
    for (const id of serviceCategoryIds) {
      const svc = await deps.serviceCategoryRepo.getById(id);
      serviceLabelMap[id] = svc?.label ?? null;
    }
  }

  function brandingSnapshot(inv: unknown): {
    address?: string | null;
    email?: string | null;
    phone?: string | null;
    gstNumber?: string | null;
    panNumber?: string | null;
    footerNote?: string | null;
  } {
    const snap = (inv as { brandingSnapshotJson?: unknown })?.brandingSnapshotJson;
    if (!snap || typeof snap !== 'object') return {};
    const s = snap as Record<string, unknown>;
    return {
      address: (s.address as string) ?? null,
      email: (s.email as string | null) ?? null,
      phone: (s.phone as string | null) ?? null,
      gstNumber: (s.gstNumber as string | null) ?? null,
      panNumber: (s.panNumber as string | null) ?? null,
      footerNote: (s.footerNote as string | null) ?? null,
    };
  }

  return invoices.map((inv) => {
    const b = brandingSnapshot(inv);
    return {
      id: inv.id,
      code: inv.code,
      type: inv.type,
      status: inv.status,
      subtotal: inv.subtotal,
      tax: inv.tax,
      total: inv.total,
      discountPaise: inv.discountPaise ?? 0,
      issuedAt: inv.issuedAt,
      pdfUrl: inv.pdfUrl ?? `/api/invoices/${inv.id}/pdf`,
      branchAddress: b.address ?? null,
      branchEmail: b.email ?? null,
      branchPhone: b.phone ?? null,
      gstNumber: b.gstNumber ?? null,
      panNumber: b.panNumber ?? null,
      footerNote: b.footerNote ?? null,
      items: (inv.items ?? []).map((item) => ({
        id: item.id,
        type: item.type,
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        ...(item.remarks != null &&
          String(item.remarks).trim() !== '' && { remarks: String(item.remarks).trim() }),
        ...(item.clothesCount != null &&
          Number.isFinite(Number(item.clothesCount)) && { clothesCount: Number(item.clothesCount) }),
        ...(item.catalogItemId != null && { catalogItemId: item.catalogItemId }),
        ...(item.catalogItemId != null && { icon: iconMap[item.catalogItemId] ?? null }),
        ...(item.segmentCategoryId != null && { segmentCategoryId: item.segmentCategoryId }),
        ...(item.segmentCategoryId != null && { segmentLabel: segmentLabelMap[item.segmentCategoryId] ?? null }),
        ...(item.serviceCategoryId != null && { serviceCategoryId: item.serviceCategoryId }),
        ...(item.serviceCategoryId != null && { serviceLabel: serviceLabelMap[item.serviceCategoryId] ?? null }),
      })),
    };
  });
}
