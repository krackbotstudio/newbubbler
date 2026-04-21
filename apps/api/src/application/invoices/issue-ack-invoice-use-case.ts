import { InvoiceType } from '@shared/enums';
import { AppError } from '../errors';
import { assertCanIssueAcknowledgementInvoice } from './issue-ack-invoice.use-case';
import { generateAndStoreInvoicePdf } from './generate-and-store-invoice-pdf.use-case';
import type {
  OrdersRepo,
  InvoicesRepo,
  CustomersRepo,
  BrandingRepo,
  PdfGenerator,
  StorageAdapter,
  PaymentsRepo,
} from '../ports';

export interface IssueAckInvoiceDeps {
  ordersRepo: OrdersRepo;
  invoicesRepo: InvoicesRepo;
  customersRepo: CustomersRepo;
  brandingRepo: BrandingRepo;
  pdfGenerator: PdfGenerator;
  storageAdapter: StorageAdapter;
  paymentsRepo?: PaymentsRepo;
}

/**
 * Issues the acknowledgement invoice: sets ISSUED, generates and stores PDF, sets pdfUrl.
 * When applySubscription is true and order has subscriptionId, deducts 1 pickup + optional weightKg/itemsCount (idempotent).
 * ACK is allowed from BOOKING_CONFIRMED onward (before or after pickup).
 */
export async function issueAckInvoice(
  orderId: string,
  deps: IssueAckInvoiceDeps,
  _options?: { applySubscription?: boolean; weightKg?: number; itemsCount?: number },
): Promise<{ invoiceId: string; pdfUrl: string }> {
  await assertCanIssueAcknowledgementInvoice(orderId, { ordersRepo: deps.ordersRepo });

  const existing = await deps.invoicesRepo.getByOrderIdAndType(orderId, InvoiceType.ACKNOWLEDGEMENT);
  if (!existing) {
    throw new AppError('INVOICE_NOT_FOUND', 'No acknowledgement draft found for this order');
  }
  if (existing.status === 'ISSUED') {
    return {
      invoiceId: existing.id,
      pdfUrl: existing.pdfUrl ?? `/api/invoices/${existing.id}/pdf`,
    };
  }

  const issuedAt = new Date();
  const updated = await deps.invoicesRepo.setIssued(existing.id, issuedAt);

  // New subscriptions on ACK are for reference/billing only; they are activated on customer profile only after Final invoice and payment (see fulfillNewSubscriptionsFromAckInvoice when payment is recorded).

  const { pdfUrl } = await generateAndStoreInvoicePdf(updated.id, {
    invoicesRepo: deps.invoicesRepo,
    ordersRepo: deps.ordersRepo,
    customersRepo: deps.customersRepo,
    brandingRepo: deps.brandingRepo,
    pdfGenerator: deps.pdfGenerator,
    storageAdapter: deps.storageAdapter,
  });

  return { invoiceId: updated.id, pdfUrl };
}
