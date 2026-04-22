import type { InvoiceStatus } from '@shared/enums';
import type { InvoiceType } from '@shared/enums';

export interface InvoiceItemRecord {
  id: string;
  type: string;
  name: string;
  quantity: number;
  /** When null/undefined, UI treats as same as `quantity`. */
  clothesCount?: number | null;
  /** Free-text per line (invoice / PDF “Remarks”). */
  remarks?: string | null;
  unitPrice: number;
  amount: number;
  catalogItemId?: string | null;
  segmentCategoryId?: string | null;
  serviceCategoryId?: string | null;
}

export interface InvoiceRecord {
  id: string;
  orderId: string | null;
  subscriptionId: string | null;
  code: string | null;
  type: InvoiceType;
  status: InvoiceStatus;
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
  subscriptionUsageKg?: number | null;
  subscriptionUsageItems?: number | null;
  /** Multiple subscriptions used for this order; array of { subscriptionId }. */
  subscriptionUsagesJson?: unknown;
  paymentStatus?: string;
  paymentOverrideReason?: string | null;
  comments?: string | null;
  /** When set at draft, ACK shows subscription line; activated only after Final + payment. */
  newSubscriptionSnapshotJson?: unknown;
  /** When set, new subscriptions from this ACK have been created (after payment). */
  newSubscriptionFulfilledAt?: Date | null;
  /** For SUBSCRIPTION type: { validTill, maxPickups, kgLimit, itemsLimit } at purchase. */
  subscriptionPurchaseSnapshotJson?: unknown;
  items?: InvoiceItemRecord[];
}

export interface CreateDraftInput {
  orderId: string;
  type: InvoiceType;
  code?: string | null;
  subtotal: number;
  tax: number;
  total: number;
  discountPaise?: number | null;
  brandingSnapshotJson?: unknown;
  items: Array<{
    type: string;
    name: string;
    quantity: number;
    clothesCount?: number | null;
    remarks?: string | null;
    unitPrice: number;
    amount: number;
    catalogItemId?: string | null;
    segmentCategoryId?: string | null;
    serviceCategoryId?: string | null;
  }>;
  orderMode?: string;
  subscriptionUtilized?: boolean;
  subscriptionId?: string | null;
  subscriptionUsageKg?: number | null;
  subscriptionUsageItems?: number | null;
  subscriptionUsagesJson?: unknown;
  paymentStatus?: string;
  comments?: string | null;
  newSubscriptionSnapshotJson?: unknown;
}

export interface UpdateDraftInput {
  subtotal: number;
  tax: number;
  total: number;
  discountPaise?: number | null;
  comments?: string | null;
  items: Array<{
    type: string;
    name: string;
    quantity: number;
    clothesCount?: number | null;
    remarks?: string | null;
    unitPrice: number;
    amount: number;
    catalogItemId?: string | null;
    segmentCategoryId?: string | null;
    serviceCategoryId?: string | null;
  }>;
  /** When updating ACK, persist order mode and subscription so BOTH saves correctly. */
  orderMode?: string;
  subscriptionUtilized?: boolean;
  subscriptionId?: string | null;
  subscriptionUsageKg?: number | null;
  subscriptionUsageItems?: number | null;
  subscriptionUsagesJson?: unknown;
  newSubscriptionSnapshotJson?: unknown;
}

/** Same as UpdateDraftInput; used to update invoice content (e.g. ACK edit after pickup). */
export type UpdateInvoiceContentInput = UpdateDraftInput;

export interface SubscriptionPurchaseSnapshot {
  validTill: string; // ISO date
  maxPickups: number;
  kgLimit: number | null;
  itemsLimit: number | null;
}

export interface CreateSubscriptionInvoiceInput {
  subscriptionId: string;
  planName: string;
  totalPaise: number;
  /** Invoice code e.g. WY-SUB-20260215-0001 */
  code?: string | null;
  brandingSnapshotJson?: unknown;
  /** For display/PDF: validity and limits (zero tax/discount by default). */
  subscriptionPurchaseSnapshot?: SubscriptionPurchaseSnapshot;
}

export interface AdminSubscriptionInvoiceFilters {
  customerId?: string;
  branchId?: string | null;
  dateFrom?: Date;
  dateTo?: Date;
  limit: number;
  cursor?: string;
}

export interface AdminSubscriptionInvoiceRow {
  invoiceId: string;
  subscriptionId: string;
  code: string | null;
  total: number;
  issuedAt: Date | null;
  paymentStatus: string;
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  planName: string;
}

export interface AdminSubscriptionInvoicesResult {
  data: AdminSubscriptionInvoiceRow[];
  nextCursor: string | null;
}

/** Unified row for Final Invoices list: order FINAL + subscription SUBSCRIPTION invoices. */
export interface AdminFinalInvoiceFilters {
  customerId?: string;
  branchId?: string | null;
  dateFrom?: Date;
  dateTo?: Date;
  limit: number;
  cursor?: string;
}

export interface AdminFinalInvoiceRow {
  invoiceId: string;
  type: 'FINAL' | 'SUBSCRIPTION';
  orderId: string | null;
  subscriptionId: string | null;
  code: string | null;
  total: number;
  issuedAt: Date | null;
  paymentStatus: string;
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  /** For SUBSCRIPTION: plan name from first item. */
  planName: string | null;
  /** Branch name from order or subscription. */
  branchName: string | null;
  /** For order (FINAL) invoices: WALK_IN | ONLINE | null. Used to show Type as Walk in / Online. */
  orderSource: string | null;
}

export interface AdminFinalInvoicesResult {
  data: AdminFinalInvoiceRow[];
  nextCursor: string | null;
}

export interface InvoicesRepo {
  getById(invoiceId: string): Promise<InvoiceRecord | null>;
  getByOrderId(orderId: string): Promise<InvoiceRecord | null>;
  getBySubscriptionIdAndType(subscriptionId: string, type: InvoiceType): Promise<InvoiceRecord | null>;
  getByOrderIdAndType(orderId: string, type: InvoiceType): Promise<InvoiceRecord | null>;
  findByOrderId(orderId: string): Promise<InvoiceRecord[]>;
  createDraft(input: CreateDraftInput): Promise<InvoiceRecord>;
  createSubscriptionInvoice(input: CreateSubscriptionInvoiceInput): Promise<InvoiceRecord>;
  updateDraft(invoiceId: string, input: UpdateDraftInput): Promise<InvoiceRecord>;
  updateInvoiceContent(invoiceId: string, input: UpdateInvoiceContentInput): Promise<InvoiceRecord>;
  setIssued(invoiceId: string, issuedAt: Date): Promise<InvoiceRecord>;
  setStatus(invoiceId: string, status: InvoiceStatus): Promise<void>;
  void(invoiceId: string): Promise<void>;
  updatePdfUrl(invoiceId: string, pdfUrl: string): Promise<void>;
  updateSubscriptionAndPayment(
    invoiceId: string,
    data: {
      subscriptionUtilized?: boolean;
      subscriptionId?: string | null;
      subscriptionUsageKg?: number | null;
      subscriptionUsageItems?: number | null;
      paymentStatus?: string;
      paymentOverrideReason?: string | null;
    },
  ): Promise<void>;
  setNewSubscriptionFulfilledAt(invoiceId: string, at: Date): Promise<void>;
  listSubscriptionInvoices(filters: AdminSubscriptionInvoiceFilters): Promise<AdminSubscriptionInvoicesResult>;
  listFinalInvoices(filters: AdminFinalInvoiceFilters): Promise<AdminFinalInvoicesResult>;
  /** Count subscription invoices issued on the given India date (for SUB code sequence). */
  countSubscriptionInvoicesIssuedOnDate(dateKey: string): Promise<number>;
}
