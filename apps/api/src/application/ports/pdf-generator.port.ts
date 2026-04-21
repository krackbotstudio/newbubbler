/**
 * Aggregate passed to PDF generator for invoice rendering.
 * Snapshot data so issued invoices don't change when branding changes.
 */
export interface InvoicePdfBrandingSnapshot {
  businessName: string;
  address: string;
  phone: string;
  email?: string | null;
  footerNote?: string | null;
  logoUrl?: string | null;
  upiId?: string | null;
  upiPayeeName?: string | null;
  upiQrUrl?: string | null;
  panNumber?: string | null;
  gstNumber?: string | null;
  termsAndConditions?: string | null;
}

/** Footer line 1: address, email, mobile (branch or branding). */
export interface InvoicePdfFooter {
  address: string;
  email: string | null;
  phone: string | null;
}

export interface InvoicePdfItemLine {
  name: string;
  quantity: number;
  /** Piece count when set; omit/null to print same as quantity. */
  clothesCount?: number | null;
  unitPrice: number;
  amount: number;
}

/** For SUBSCRIPTION (purchase) invoice PDF: validity and limits. */
export interface InvoicePdfSubscriptionPurchaseSummary {
  validTill: Date;
  maxPickups: number;
  kgLimit: number | null;
  itemsLimit: number | null;
}

export interface InvoicePdfAggregate {
  invoiceId: string;
  type: 'ACKNOWLEDGEMENT' | 'FINAL' | 'SUBSCRIPTION';
  /** Not set for SUBSCRIPTION-only invoices. */
  orderId?: string | null;
  issuedAt: Date;
  branding: InvoicePdfBrandingSnapshot;
  /** Footer line 1: branch/branding address, email, mobile; line 2 is fixed. */
  footer: InvoicePdfFooter;
  /** Customer name and phone for display */
  customerName?: string | null;
  customerPhone?: string | null;
  items: InvoicePdfItemLine[];
  subtotal: number;
  tax: number;
  discountPaise: number | null;
  total: number;
  /** Optional: subscription usage summary for ACK */
  subscriptionSummary?: {
    usedKg: number;
    usedItemsCount: number;
    remainingPickups: number;
    expiryDate: Date;
  };
  /** For SUBSCRIPTION type: validity, pickups, weight/items limits. */
  subscriptionPurchaseSummary?: InvoicePdfSubscriptionPurchaseSummary;
}

export interface PdfGenerator {
  generateInvoicePdfBuffer(aggregate: InvoicePdfAggregate): Promise<Buffer>;
}
