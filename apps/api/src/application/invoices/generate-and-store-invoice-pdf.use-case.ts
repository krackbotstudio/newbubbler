import { AppError } from '../errors';
import type {
  InvoicesRepo,
  OrdersRepo,
  CustomersRepo,
  BrandingRepo,
  BranchRepo,
  SubscriptionsRepo,
  PdfGenerator,
  StorageAdapter,
  InvoicePdfAggregate,
  InvoicePdfBrandingSnapshot,
  InvoicePdfFooter,
} from '../ports';
import { getBrandingSnapshotForBranchId } from './create-final-invoice-draft.use-case';

export interface GenerateAndStoreInvoicePdfDeps {
  invoicesRepo: InvoicesRepo;
  ordersRepo: OrdersRepo;
  customersRepo: CustomersRepo;
  brandingRepo: BrandingRepo;
  /** Required when generating PDF for subscription invoices (to use main branch branding). */
  branchRepo?: BranchRepo;
  /** Required when generating PDF for subscription-only (SUBSCRIPTION) invoices. */
  subscriptionsRepo?: SubscriptionsRepo;
  pdfGenerator: PdfGenerator;
  storageAdapter: StorageAdapter;
}

function brandingFromSnapshot(snapshot: unknown): InvoicePdfBrandingSnapshot {
  if (!snapshot || typeof snapshot !== 'object') {
    return {
      businessName: 'Business',
      address: '',
      phone: '',
    };
  }
  const s = snapshot as Record<string, unknown>;
  return {
    businessName: (s.businessName as string) ?? 'Business',
    address: (s.address as string) ?? '',
    phone: (s.phone as string) ?? '',
    email: (s.email as string | null) ?? null,
    footerNote: (s.footerNote as string | null) ?? null,
    logoUrl: (s.logoUrl as string | null) ?? null,
    upiId: (s.upiId as string | null) ?? null,
    upiPayeeName: (s.upiPayeeName as string | null) ?? null,
    upiQrUrl: (s.upiQrUrl as string | null) ?? null,
    panNumber: (s.panNumber as string | null) ?? null,
    gstNumber: (s.gstNumber as string | null) ?? null,
    termsAndConditions: (s.termsAndConditions as string | null) ?? null,
  };
}

function footerFromBranding(b: InvoicePdfBrandingSnapshot): InvoicePdfFooter {
  return {
    address: b.address ?? '',
    email: b.email ?? null,
    phone: b.phone ?? null,
  };
}

function subscriptionPurchaseSummaryFromSnapshot(snapshot: unknown): InvoicePdfAggregate['subscriptionPurchaseSummary'] | undefined {
  if (!snapshot || typeof snapshot !== 'object') return undefined;
  const s = snapshot as Record<string, unknown>;
  const validTill = s.validTill;
  if (typeof validTill !== 'string' && !(validTill instanceof Date)) return undefined;
  const validTillDate = typeof validTill === 'string' ? new Date(validTill) : validTill;
  return {
    validTill: validTillDate,
    maxPickups: typeof s.maxPickups === 'number' ? s.maxPickups : 0,
    kgLimit: typeof s.kgLimit === 'number' ? s.kgLimit : (s.kgLimit == null ? null : Number(s.kgLimit)),
    itemsLimit: typeof s.itemsLimit === 'number' ? s.itemsLimit : (s.itemsLimit == null ? null : Number(s.itemsLimit)),
  };
}

/**
 * Builds invoice PDF aggregate, generates PDF buffer, stores it, and updates pdfUrl.
 * Invoice must exist and be ISSUED (have issuedAt).
 * Supports order invoices (ACK/FINAL) and subscription-only (SUBSCRIPTION) invoices.
 */
export async function generateAndStoreInvoicePdf(
  invoiceId: string,
  deps: GenerateAndStoreInvoicePdfDeps,
): Promise<{ pdfUrl: string }> {
  const invoice = await deps.invoicesRepo.getById(invoiceId);
  if (!invoice) {
    throw new AppError('INVOICE_NOT_FOUND', 'Invoice not found', { invoiceId });
  }
  if (invoice.status !== 'ISSUED' || !invoice.issuedAt) {
    throw new AppError('INVOICE_NOT_FOUND', 'Invoice must be issued before generating PDF');
  }

  const items = invoice.items ?? [];
  // Subscription invoices use the branch that serves the subscription address (pincode); fallback to main branch
  let branding: InvoicePdfBrandingSnapshot;
  /** When true, do not substitute global terms — branch terms (even empty) are authoritative for this PDF. */
  let branchTermsAuthoritative = false;
  if (invoice.subscriptionId && deps.branchRepo) {
    let branchIdForBranding: string | null = null;
    if (deps.subscriptionsRepo) {
      const sub = await deps.subscriptionsRepo.getById(invoice.subscriptionId);
      if (sub?.branchId) branchIdForBranding = sub.branchId;
    }
    if (!branchIdForBranding) {
      const branches = await deps.branchRepo.listAll();
      const mainBranch = branches.find((b) => b.isDefault) ?? branches[0] ?? null;
      branchIdForBranding = mainBranch?.id ?? null;
    }
    const branchSnapshot = branchIdForBranding
      ? await getBrandingSnapshotForBranchId(branchIdForBranding, { branchRepo: deps.branchRepo, brandingRepo: deps.brandingRepo })
      : undefined;
    branding = branchSnapshot
      ? {
          businessName: branchSnapshot.businessName,
          address: branchSnapshot.address,
          phone: branchSnapshot.phone,
          email: branchSnapshot.email ?? null,
          footerNote: branchSnapshot.footerNote ?? null,
          logoUrl: branchSnapshot.logoUrl ?? null,
          upiId: branchSnapshot.upiId ?? null,
          upiPayeeName: branchSnapshot.upiPayeeName ?? null,
          upiQrUrl: branchSnapshot.upiQrUrl ?? null,
          panNumber: branchSnapshot.panNumber ?? null,
          gstNumber: branchSnapshot.gstNumber ?? null,
          termsAndConditions: branchSnapshot.termsAndConditions ?? null,
        }
      : brandingFromSnapshot(invoice.brandingSnapshotJson);
    branchTermsAuthoritative = !!branchSnapshot;
  } else {
    branding = brandingFromSnapshot(invoice.brandingSnapshotJson);
  }
  if (!branding.termsAndConditions?.trim() && !branchTermsAuthoritative) {
    const currentBranding = await deps.brandingRepo.get();
    if (currentBranding?.termsAndConditions?.trim()) {
      branding.termsAndConditions = currentBranding.termsAndConditions;
    }
  }
  const footer = footerFromBranding(branding);

  let customerName: string | null = null;
  let customerPhone: string | null = null;
  let aggregate: InvoicePdfAggregate;

  if (invoice.orderId) {
    const order = await deps.ordersRepo.getById(invoice.orderId);
    if (!order) {
      throw new AppError('ORDER_NOT_FOUND', 'Order not found for invoice');
    }
    const customer = await deps.customersRepo.getById(order.userId);
    customerName = customer?.name ?? null;
    customerPhone = customer?.phone ?? null;
    aggregate = {
      invoiceId: invoice.id,
      type: invoice.type as 'ACKNOWLEDGEMENT' | 'FINAL',
      orderId: invoice.orderId,
      issuedAt: invoice.issuedAt!,
      branding,
      footer,
      customerName,
      customerPhone,
      items: items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        amount: i.amount,
      })),
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      discountPaise: invoice.discountPaise,
      total: invoice.total,
    };
  } else if (invoice.subscriptionId) {
    if (!deps.subscriptionsRepo) {
      throw new AppError('INVOICE_NOT_FOUND', 'Subscription repo required to generate subscription invoice PDF');
    }
    const subscription = await deps.subscriptionsRepo.getById(invoice.subscriptionId);
    if (!subscription) {
      throw new AppError('INVOICE_NOT_FOUND', 'Subscription not found for invoice', {
        subscriptionId: invoice.subscriptionId,
      });
    }
    const customer = await deps.customersRepo.getById(subscription.userId);
    customerName = customer?.name ?? null;
    customerPhone = customer?.phone ?? null;
    const subscriptionPurchaseSummary = subscriptionPurchaseSummaryFromSnapshot(
      (invoice as { subscriptionPurchaseSnapshotJson?: unknown }).subscriptionPurchaseSnapshotJson,
    );
    aggregate = {
      invoiceId: invoice.id,
      type: 'SUBSCRIPTION',
      orderId: null,
      issuedAt: invoice.issuedAt!,
      branding,
      footer,
      customerName,
      customerPhone,
      items: items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        amount: i.amount,
      })),
      subtotal: invoice.subtotal,
      tax: invoice.tax,
      discountPaise: invoice.discountPaise,
      total: invoice.total,
      subscriptionPurchaseSummary,
    };
  } else {
    throw new AppError('INVOICE_NOT_FOUND', 'Invoice must have orderId or subscriptionId');
  }

  const buffer = await deps.pdfGenerator.generateInvoicePdfBuffer(aggregate);
  const storagePath = `invoices/${invoiceId}.pdf`;
  await deps.storageAdapter.putObject(storagePath, buffer, 'application/pdf');

  const pdfUrl = `/api/invoices/${invoiceId}/pdf`;
  await deps.invoicesRepo.updatePdfUrl(invoiceId, pdfUrl);

  return { pdfUrl };
}
