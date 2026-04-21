import { AppError } from '../errors';
import type {
  InvoicesRepo,
  OrdersRepo,
  CustomersRepo,
  BrandingRepo,
  BranchRepo,
  PdfGenerator,
  StorageAdapter,
  InvoicePdfAggregate,
  InvoicePdfBrandingSnapshot,
  InvoicePdfFooter,
} from '../ports';

export interface GenerateAndStoreInvoicePdfDeps {
  invoicesRepo: InvoicesRepo;
  ordersRepo: OrdersRepo;
  customersRepo: CustomersRepo;
  brandingRepo: BrandingRepo;
  branchRepo?: BranchRepo;
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

/**
 * Builds invoice PDF aggregate, generates PDF buffer, stores it, and updates pdfUrl.
 * Invoice must exist and be ISSUED (have issuedAt).
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
  let branding: InvoicePdfBrandingSnapshot;
  /** When true, do not substitute global terms — branch terms (even empty) are authoritative for this PDF. */
  let branchTermsAuthoritative = false;
  branding = brandingFromSnapshot(invoice.brandingSnapshotJson);
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

  if (!invoice.orderId) {
    throw new AppError('INVOICE_NOT_FOUND', 'Invoice must have an orderId');
  }
  if (invoice.subscriptionId) {
    throw new AppError('INVOICE_NOT_FOUND', 'Subscription invoices are not supported');
  }
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
      clothesCount: i.clothesCount ?? null,
      unitPrice: i.unitPrice,
      amount: i.amount,
    })),
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    discountPaise: invoice.discountPaise,
    total: invoice.total,
  };

  const buffer = await deps.pdfGenerator.generateInvoicePdfBuffer(aggregate);
  const storagePath = `invoices/${invoiceId}.pdf`;
  await deps.storageAdapter.putObject(storagePath, buffer, 'application/pdf');

  const pdfUrl = `/api/invoices/${invoiceId}/pdf`;
  await deps.invoicesRepo.updatePdfUrl(invoiceId, pdfUrl);

  return { pdfUrl };
}
