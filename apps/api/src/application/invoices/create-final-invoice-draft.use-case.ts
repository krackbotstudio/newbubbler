import { InvoiceType } from '@shared/enums';
import { assertCanIssueFinalInvoice } from './issue-final-invoice.use-case';
import type { OrdersRepo, InvoicesRepo, BrandingRepo, BranchRepo, ServiceAreaRepo, OrderRecord } from '../ports';
import type { CreateDraftInput } from '../ports';
import { calculateInvoiceTotals } from './calculate-invoice-totals';
import type { InvoiceItemType } from '@shared/enums';

/** Normalize branch invoice prefix for use inside invoice codes (alphanumeric + _ -). */
export function normalizeBranchInvoicePrefixSegment(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const t = raw.trim().replace(/\s+/g, '-').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
  return t || null;
}

/** ACK invoice code; optional branch segment when `invoicePrefix` is set on the branch. */
export function formatAckInvoiceCode(orderId: string, branchInvoicePrefix: string | null | undefined): string {
  const p = normalizeBranchInvoicePrefixSegment(branchInvoicePrefix);
  return p ? `ACK-${p}-${orderId}` : `ACK - ${orderId}`;
}

/** Final invoice code; optional branch segment when `invoicePrefix` is set on the branch. */
export function formatFinalInvoiceCode(orderId: string, branchInvoicePrefix: string | null | undefined): string {
  const p = normalizeBranchInvoicePrefixSegment(branchInvoicePrefix);
  return p ? `IN-${p}-${orderId}` : `IN${orderId}`;
}

/** Raw `invoicePrefix` from the branch that owns this order (by branchId or service-area pincode). */
export async function getBranchInvoicePrefixForOrder(
  order: OrderRecord,
  deps: { branchRepo: BranchRepo; serviceAreaRepo: ServiceAreaRepo },
): Promise<string | null> {
  let branchId = order.branchId ?? null;
  if (!branchId && order.pincode) {
    const sa = await deps.serviceAreaRepo.getByPincode(order.pincode);
    branchId = sa?.branchId ?? null;
  }
  if (!branchId) return null;
  const branch = await deps.branchRepo.getById(branchId);
  const raw = branch?.invoicePrefix?.trim();
  return raw ? raw : null;
}

export interface CreateFinalInvoiceDraftInput {
  orderId: string;
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
  comments?: string | null;
  /** Weight (kg) used for subscription; reflected from ACK, editable on Final until payment. */
  subscriptionUsageKg?: number | null;
  subscriptionUsageItems?: number | null;
}

export interface CreateFinalInvoiceDraftDeps {
  ordersRepo: OrdersRepo;
  invoicesRepo: InvoicesRepo;
  brandingRepo: BrandingRepo;
  branchRepo: BranchRepo;
  serviceAreaRepo: ServiceAreaRepo;
}

/** Resolve branding snapshot for an order: use branch's GST/PAN/UPI when order belongs to a branch, else global branding. Exported for use in ACK draft. */
export async function getBrandingSnapshotForOrder(
  order: OrderRecord,
  deps: { branchRepo: BranchRepo; serviceAreaRepo: ServiceAreaRepo; brandingRepo: BrandingRepo },
): Promise<{
  businessName: string;
  address: string;
  phone: string;
  email: string | null;
  footerNote: string | null;
  logoUrl: string | null;
  upiId: string | null;
  upiPayeeName: string | null;
  upiQrUrl: string | null;
  panNumber: string | null;
  gstNumber: string | null;
  termsAndConditions: string | null;
} | undefined> {
  let branchId = order.branchId ?? null;
  if (!branchId && order.pincode) {
    const sa = await deps.serviceAreaRepo.getByPincode(order.pincode);
    branchId = sa?.branchId ?? null;
  }
  if (branchId) {
    const branch = await deps.branchRepo.getById(branchId);
    if (branch) {
      return {
        businessName: branch.name,
        address: branch.address,
        phone: branch.phone ?? '',
        email: branch.email ?? null,
        footerNote: branch.footerNote ?? null,
        logoUrl: branch.logoUrl ?? null,
        upiId: branch.upiId ?? null,
        upiPayeeName: branch.upiPayeeName ?? null,
        upiQrUrl: branch.upiQrUrl ?? null,
        panNumber: branch.panNumber ?? null,
        gstNumber: branch.gstNumber ?? null,
        termsAndConditions: branch.termsAndConditions?.trim() || null,
      };
    }
  }
  const branding = await deps.brandingRepo.get();
  if (!branding) return undefined;
  return {
    businessName: branding.businessName,
    address: branding.address,
    phone: branding.phone,
    email: branding.email ?? null,
    footerNote: branding.footerNote,
    logoUrl: branding.logoUrl,
    upiId: branding.upiId,
    upiPayeeName: branding.upiPayeeName,
    upiQrUrl: branding.upiQrUrl,
    panNumber: null,
    gstNumber: null,
    termsAndConditions: branding.termsAndConditions ?? null,
  };
}

/** Resolve branding snapshot for a branch (e.g. subscription invoice). Use branch's GST/PAN/UPI when branchId given, else global branding. */
export async function getBrandingSnapshotForBranchId(
  branchId: string | null,
  deps: { branchRepo: BranchRepo; brandingRepo: BrandingRepo },
): Promise<{
  businessName: string;
  address: string;
  phone: string;
  email: string | null;
  footerNote: string | null;
  logoUrl: string | null;
  upiId: string | null;
  upiPayeeName: string | null;
  upiQrUrl: string | null;
  panNumber: string | null;
  gstNumber: string | null;
  termsAndConditions: string | null;
} | undefined> {
  if (branchId) {
    const branch = await deps.branchRepo.getById(branchId);
    if (branch) {
      return {
        businessName: branch.name,
        address: branch.address,
        phone: branch.phone ?? '',
        email: branch.email ?? null,
        footerNote: branch.footerNote ?? null,
        logoUrl: branch.logoUrl ?? null,
        upiId: branch.upiId ?? null,
        upiPayeeName: branch.upiPayeeName ?? null,
        upiQrUrl: branch.upiQrUrl ?? null,
        panNumber: branch.panNumber ?? null,
        gstNumber: branch.gstNumber ?? null,
        termsAndConditions: branch.termsAndConditions?.trim() || null,
      };
    }
  }
  const branding = await deps.brandingRepo.get();
  if (!branding) return undefined;
  return {
    businessName: branding.businessName,
    address: branding.address,
    phone: branding.phone,
    email: branding.email ?? null,
    footerNote: branding.footerNote,
    logoUrl: branding.logoUrl,
    upiId: branding.upiId,
    upiPayeeName: branding.upiPayeeName,
    upiQrUrl: branding.upiQrUrl,
    panNumber: null,
    gstNumber: null,
    termsAndConditions: branding.termsAndConditions ?? null,
  };
}

export async function createFinalInvoiceDraft(
  input: CreateFinalInvoiceDraftInput,
  deps: CreateFinalInvoiceDraftDeps,
): Promise<{ invoiceId: string; subtotal: number; tax: number; total: number }> {
  await assertCanIssueFinalInvoice(input.orderId, { ordersRepo: deps.ordersRepo });

  const totals = calculateInvoiceTotals(
    input.items.map((i) => ({
      type: i.type as InvoiceItemType,
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      amount: i.amount,
    })),
    input.tax ?? 0,
  );
  const totalAfterDiscount =
    (totals.total - (input.discountPaise ?? 0)) | 0;

  const existing = await deps.invoicesRepo.getByOrderIdAndType(input.orderId, InvoiceType.FINAL);
  const updatePayload = {
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totalAfterDiscount,
    discountPaise: input.discountPaise ?? null,
    comments: input.comments ?? null,
    ...(input.subscriptionUsageKg !== undefined && { subscriptionUsageKg: input.subscriptionUsageKg }),
    ...(input.subscriptionUsageItems !== undefined && { subscriptionUsageItems: input.subscriptionUsageItems }),
    items: input.items.map((i, idx) => ({
      type: i.type,
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      amount: totals.items[idx].amount,
      catalogItemId: i.catalogItemId,
      segmentCategoryId: i.segmentCategoryId,
      serviceCategoryId: i.serviceCategoryId,
    })),
  };

  if (existing?.status === 'DRAFT') {
    const updated = await deps.invoicesRepo.updateDraft(existing.id, updatePayload);
    return { invoiceId: updated.id, subtotal: updated.subtotal, tax: updated.tax, total: updated.total };
  }

  if (existing?.status === 'ISSUED') {
    const order = await deps.ordersRepo.getById(input.orderId);
    if (!order) throw new Error('Order not found');
    if (order.paymentStatus === 'CAPTURED') {
      throw new Error('Final invoice cannot be edited after payment has been collected.');
    }
    const updated = await deps.invoicesRepo.updateInvoiceContent(existing.id, updatePayload);
    return { invoiceId: updated.id, subtotal: updated.subtotal, tax: updated.tax, total: updated.total };
  }

  const order = await deps.ordersRepo.getById(input.orderId);
  if (!order) throw new Error('Order not found');
  const invoicePrefix = await getBranchInvoicePrefixForOrder(order, {
    branchRepo: deps.branchRepo,
    serviceAreaRepo: deps.serviceAreaRepo,
  });
  const code = formatFinalInvoiceCode(order.id, invoicePrefix);

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

  const createInput: CreateDraftInput = {
    orderId: input.orderId,
    type: InvoiceType.FINAL,
    code,
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totalAfterDiscount,
    discountPaise: input.discountPaise ?? null,
    brandingSnapshotJson,
    ...(input.subscriptionUsageKg !== undefined && { subscriptionUsageKg: input.subscriptionUsageKg }),
    ...(input.subscriptionUsageItems !== undefined && { subscriptionUsageItems: input.subscriptionUsageItems }),
    items: input.items.map((i, idx) => ({
      type: i.type,
      name: i.name,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      amount: totals.items[idx].amount,
      catalogItemId: i.catalogItemId,
      segmentCategoryId: i.segmentCategoryId,
      serviceCategoryId: i.serviceCategoryId,
    })),
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
