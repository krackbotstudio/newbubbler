import { InvoiceType } from '@shared/enums';
import { assertCanIssueAcknowledgementInvoice } from './issue-ack-invoice.use-case';
import type { OrdersRepo, InvoicesRepo, BrandingRepo, BranchRepo, ServiceAreaRepo } from '../ports';
import type { CreateDraftInput } from '../ports';
import { calculateInvoiceTotals } from './calculate-invoice-totals';
import {
  formatAckInvoiceCode,
  getBrandingSnapshotForOrder,
  getBranchInvoicePrefixForOrder,
} from './create-final-invoice-draft.use-case';
import type { InvoiceItemType } from '@shared/enums';

export interface CreateAckInvoiceDraftInput {
  orderId: string;
  orderMode?: 'INDIVIDUAL';
  items: Array<{
    type: string;
    name: string;
    quantity: number;
    clothesCount?: number | null;
    unitPrice: number;
    amount?: number;
    catalogItemId?: string | null;
    segmentCategoryId?: string | null;
    serviceCategoryId?: string | null;
  }>;
  tax?: number;
  discountPaise?: number | null;
  comments?: string | null;
}

export interface CreateAckInvoiceDraftDeps {
  ordersRepo: OrdersRepo;
  invoicesRepo: InvoicesRepo;
  brandingRepo: BrandingRepo;
  branchRepo: BranchRepo;
  serviceAreaRepo: ServiceAreaRepo;
}

const ORDER_MODES = ['INDIVIDUAL'] as const;

export async function createAckInvoiceDraft(
  input: CreateAckInvoiceDraftInput,
  deps: CreateAckInvoiceDraftDeps,
): Promise<{ invoiceId: string; subtotal: number; tax: number; total: number }> {
  await assertCanIssueAcknowledgementInvoice(input.orderId, { ordersRepo: deps.ordersRepo });

  const orderMode = (input.orderMode && ORDER_MODES.includes(input.orderMode as typeof ORDER_MODES[number])
    ? input.orderMode
    : 'INDIVIDUAL') as 'INDIVIDUAL';

  const itemsForTotals = input.items.map((i) => ({
    type: i.type as InvoiceItemType,
    name: i.name,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    amount: i.amount,
  }));
  const totals = calculateInvoiceTotals(itemsForTotals, input.tax ?? 0);
  const totalAfterDiscount = (totals.total - (input.discountPaise ?? 0)) | 0;

  const order = await deps.ordersRepo.getById(input.orderId);
  if (!order) throw new Error('Order not found');
  const brandingSnapshot = await getBrandingSnapshotForOrder(order, {
    branchRepo: deps.branchRepo,
    serviceAreaRepo: deps.serviceAreaRepo,
    brandingRepo: deps.brandingRepo,
  });
  const brandingSnapshotJson = brandingSnapshot
    ? {
        businessName: brandingSnapshot.businessName,
        address: brandingSnapshot.address,
        phone: brandingSnapshot.phone,
        email: brandingSnapshot.email ?? null,
        footerNote: brandingSnapshot.footerNote,
        logoUrl: brandingSnapshot.logoUrl,
        upiId: brandingSnapshot.upiId,
        upiPayeeName: brandingSnapshot.upiPayeeName,
        upiQrUrl: brandingSnapshot.upiQrUrl,
        panNumber: brandingSnapshot.panNumber ?? null,
        gstNumber: brandingSnapshot.gstNumber ?? null,
        termsAndConditions: brandingSnapshot.termsAndConditions ?? null,
      }
    : undefined;

  const draftItems = itemsForTotals.map((i, idx) => ({
    type: i.type,
    name: i.name,
    quantity: i.quantity,
    ...(input.items[idx]?.clothesCount != null &&
      Number.isFinite(input.items[idx]!.clothesCount!) && {
        clothesCount: input.items[idx]!.clothesCount,
      }),
    unitPrice: i.unitPrice,
    amount: totals.items[idx]?.amount ?? i.amount,
    catalogItemId: input.items[idx]?.catalogItemId ?? undefined,
    segmentCategoryId: input.items[idx]?.segmentCategoryId ?? undefined,
    serviceCategoryId: input.items[idx]?.serviceCategoryId ?? undefined,
  }));
  const existing = await deps.invoicesRepo.getByOrderIdAndType(input.orderId, InvoiceType.ACKNOWLEDGEMENT);
  const updatePayload = {
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totalAfterDiscount,
    discountPaise: input.discountPaise ?? null,
    comments: input.comments ?? null,
    items: draftItems,
    orderMode,
  };

  if (existing) {
    if (existing.status === 'DRAFT') {
      const updated = await deps.invoicesRepo.updateDraft(existing.id, updatePayload);
      return { invoiceId: updated.id, subtotal: updated.subtotal, tax: updated.tax, total: updated.total };
    }
    // Edge case: edit after pickup (ACK already issued)
    const updated = await deps.invoicesRepo.updateInvoiceContent(existing.id, updatePayload);
    return { invoiceId: updated.id, subtotal: updated.subtotal, tax: updated.tax, total: updated.total };
  }

  const invoicePrefix = await getBranchInvoicePrefixForOrder(order, {
    branchRepo: deps.branchRepo,
    serviceAreaRepo: deps.serviceAreaRepo,
  });
  const code = formatAckInvoiceCode(order.id, invoicePrefix);

  const createInput: CreateDraftInput = {
    orderId: input.orderId,
    type: InvoiceType.ACKNOWLEDGEMENT,
    code,
    orderMode,
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totalAfterDiscount,
    discountPaise: input.discountPaise ?? null,
    brandingSnapshotJson,
    items: draftItems,
    paymentStatus: 'DUE',
    ...(input.comments !== undefined && { comments: input.comments }),
  };
  const invoice = await deps.invoicesRepo.createDraft(createInput);
  return {
    invoiceId: invoice.id,
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    total: invoice.total,
  };
}
