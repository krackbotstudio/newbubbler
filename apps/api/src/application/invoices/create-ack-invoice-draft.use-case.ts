import { InvoiceType, InvoiceOrderMode } from '@shared/enums';
import { assertCanIssueAcknowledgementInvoice } from './issue-ack-invoice.use-case';
import type { OrdersRepo, InvoicesRepo, BrandingRepo, BranchRepo, ServiceAreaRepo, SubscriptionPlansRepo } from '../ports';
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
  orderMode?: 'INDIVIDUAL' | 'SUBSCRIPTION_ONLY' | 'BOTH';
  items: Array<{
    type: string;
    name: string;
    quantity: number;
    unitPrice: number;
    amount?: number;
    catalogItemId?: string | null;
    segmentCategoryId?: string | null;
    serviceCategoryId?: string | null;
  }>;
  tax?: number;
  discountPaise?: number | null;
  subscriptionUtilized?: boolean;
  subscriptionId?: string | null;
  subscriptionUsageKg?: number | null;
  subscriptionUsageItems?: number | null;
  /** When set, multiple subscriptions selected for this pickup; each gets 1 pickup + weight/items. Stored as subscriptionUsagesJson. */
  subscriptionUsageSubscriptionIds?: string[] | null;
  /** When set, add subscription line at plan price; subscription is created only after Final invoice and payment. quantity = multiplier for plan validity/limits (e.g. 2 × 10 days = 20 days). */
  newSubscription?: { planId: string; validityStartDate: string; quantityMonths?: number } | null;
  /** Multiple new subscriptions on same invoice; each created/activated only after Final invoice and payment. */
  newSubscriptions?: Array<{ planId: string; validityStartDate: string; quantityMonths?: number }> | null;
  comments?: string | null;
}

export interface CreateAckInvoiceDraftDeps {
  ordersRepo: OrdersRepo;
  invoicesRepo: InvoicesRepo;
  brandingRepo: BrandingRepo;
  branchRepo: BranchRepo;
  serviceAreaRepo: ServiceAreaRepo;
  subscriptionPlansRepo: SubscriptionPlansRepo;
}

const ORDER_MODES = ['INDIVIDUAL', 'SUBSCRIPTION_ONLY', 'BOTH'] as const;

export async function createAckInvoiceDraft(
  input: CreateAckInvoiceDraftInput,
  deps: CreateAckInvoiceDraftDeps,
): Promise<{ invoiceId: string; subtotal: number; tax: number; total: number }> {
  await assertCanIssueAcknowledgementInvoice(input.orderId, { ordersRepo: deps.ordersRepo });

  const orderMode = (input.orderMode && ORDER_MODES.includes(input.orderMode as typeof ORDER_MODES[number])
    ? input.orderMode
    : 'INDIVIDUAL') as 'INDIVIDUAL' | 'SUBSCRIPTION_ONLY' | 'BOTH';

  const hasNewSubs = (input.newSubscriptions?.length ?? 0) > 0 || (input.newSubscription?.planId && input.newSubscription?.validityStartDate);
  if (orderMode === InvoiceOrderMode.SUBSCRIPTION_ONLY) {
    if (!input.subscriptionId && !hasNewSubs) {
      throw new Error('SUBSCRIPTION_ONLY requires subscriptionId or newSubscription(s)');
    }
    if (input.subscriptionId) {
      const hasUsage = (input.subscriptionUsageKg != null && Number(input.subscriptionUsageKg) > 0) ||
        (input.subscriptionUsageItems != null && Number(input.subscriptionUsageItems) > 0);
      if (!hasUsage) {
        throw new Error('SUBSCRIPTION_ONLY with existing subscription requires subscriptionUsageKg or subscriptionUsageItems');
      }
    }
    if (input.items.length > 0) {
      throw new Error('SUBSCRIPTION_ONLY must not have manual line items');
    }
  }

  if (orderMode === InvoiceOrderMode.INDIVIDUAL && (input.subscriptionId || hasNewSubs)) {
    throw new Error('INDIVIDUAL order mode must not include subscription or newSubscription(s)');
  }

  const MIN_QUANTITY = 1;
  const MAX_QUANTITY = 12;
  type Snapshot = { planId: string; planName: string; validityStartDate: string; pricePaise: number; quantityMonths: number };
  const newSubscriptionSnapshots: Snapshot[] = [];

  const sources: Array<{ planId: string; validityStartDate: string; quantityMonths?: number }> = [];
  if (input.newSubscriptions?.length) {
    sources.push(...input.newSubscriptions);
  } else if (input.newSubscription?.planId && input.newSubscription?.validityStartDate) {
    sources.push(input.newSubscription);
  }
  for (const entry of sources) {
    const plan = await deps.subscriptionPlansRepo.getById(entry.planId);
    if (!plan || !plan.active) {
      throw new Error('Subscription plan not found or inactive');
    }
    const raw = entry.quantityMonths != null ? Number(entry.quantityMonths) : 1;
    const quantityMonths = Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.floor(raw)));
    newSubscriptionSnapshots.push({
      planId: plan.id,
      planName: plan.name,
      validityStartDate: entry.validityStartDate,
      pricePaise: plan.pricePaise * quantityMonths,
      quantityMonths,
    });
  }

  const isSubscriptionOnly = orderMode === InvoiceOrderMode.SUBSCRIPTION_ONLY;
  const itemsForTotals = input.items.map((i) => ({
    type: i.type as InvoiceItemType,
    name: i.name,
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    amount: i.amount,
  }));
  for (const snap of newSubscriptionSnapshots) {
    itemsForTotals.push({
      type: 'FEE' as InvoiceItemType,
      name: `Subscription - ${snap.planName}`,
      quantity: 1,
      unitPrice: snap.pricePaise,
      amount: snap.pricePaise,
    });
  }
  const hasAnyNewSub = newSubscriptionSnapshots.length > 0;
  const newSubscriptionSnapshotJson =
    newSubscriptionSnapshots.length === 0
      ? undefined
      : newSubscriptionSnapshots.length === 1
        ? newSubscriptionSnapshots[0]
        : newSubscriptionSnapshots;
  const totals = isSubscriptionOnly && !hasAnyNewSub
    ? { subtotal: 0, tax: 0, total: 0, items: [] as Array<{ amount: number }> }
    : calculateInvoiceTotals(itemsForTotals, input.tax ?? 0);
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
    unitPrice: i.unitPrice,
    amount: totals.items[idx]?.amount ?? i.amount,
    catalogItemId: input.items[idx]?.catalogItemId ?? undefined,
    segmentCategoryId: input.items[idx]?.segmentCategoryId ?? undefined,
    serviceCategoryId: input.items[idx]?.serviceCategoryId ?? undefined,
  }));
  const subscriptionUsagesJson =
    input.subscriptionUsageSubscriptionIds?.length
      ? input.subscriptionUsageSubscriptionIds.map((sid) => ({ subscriptionId: sid }))
      : undefined;
  const primarySubscriptionId =
    subscriptionUsagesJson ? input.subscriptionUsageSubscriptionIds![0] : input.subscriptionId;
  const existing = await deps.invoicesRepo.getByOrderIdAndType(input.orderId, InvoiceType.ACKNOWLEDGEMENT);
  const updatePayload = {
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totalAfterDiscount,
    discountPaise: isSubscriptionOnly && !hasAnyNewSub ? null : (input.discountPaise ?? null),
    comments: input.comments ?? null,
    items: draftItems,
    orderMode,
    ...(input.subscriptionUtilized !== undefined && { subscriptionUtilized: input.subscriptionUtilized }),
    ...(subscriptionUsagesJson ? { subscriptionUtilized: true, subscriptionId: primarySubscriptionId, subscriptionUsagesJson } : input.subscriptionId !== undefined && { subscriptionId: input.subscriptionId }),
    ...(input.subscriptionUsageKg !== undefined && { subscriptionUsageKg: input.subscriptionUsageKg }),
    ...(input.subscriptionUsageItems !== undefined && { subscriptionUsageItems: input.subscriptionUsageItems }),
    ...(newSubscriptionSnapshotJson !== undefined && { newSubscriptionSnapshotJson: newSubscriptionSnapshotJson }),
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
    discountPaise: isSubscriptionOnly && !hasAnyNewSub ? null : (input.discountPaise ?? null),
    brandingSnapshotJson,
    items: draftItems,
    ...(input.subscriptionUtilized !== undefined && { subscriptionUtilized: input.subscriptionUtilized }),
    ...(subscriptionUsagesJson ? { subscriptionUtilized: true, subscriptionId: primarySubscriptionId, subscriptionUsagesJson } : input.subscriptionId !== undefined && { subscriptionId: input.subscriptionId }),
    ...(input.subscriptionUsageKg !== undefined && { subscriptionUsageKg: input.subscriptionUsageKg }),
    ...(input.subscriptionUsageItems !== undefined && { subscriptionUsageItems: input.subscriptionUsageItems }),
    ...(newSubscriptionSnapshotJson !== undefined && { newSubscriptionSnapshotJson: newSubscriptionSnapshotJson }),
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
