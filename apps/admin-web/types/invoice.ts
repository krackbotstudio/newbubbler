export type InvoiceItemType =
  | 'SERVICE'
  | 'DRYCLEAN_ITEM'
  | 'ADDON'
  | 'FEE'
  | 'DISCOUNT';

export interface InvoiceDraftItem {
  type: InvoiceItemType;
  name: string;
  quantity: number;
  /** Per-line remarks (ACK / Final invoices and PDF). Max 500 chars. */
  remarks?: string;
  unitPricePaise: number;
  amountPaise?: number;
  /** Catalog matrix: item id for Item → Segment → Service cascading */
  catalogItemId?: string | null;
  segmentCategoryId?: string | null;
  serviceCategoryId?: string | null;
}

export type InvoiceOrderMode = 'INDIVIDUAL';

export interface InvoiceDraftBody {
  orderMode?: InvoiceOrderMode;
  items: InvoiceDraftItem[];
  taxPaise?: number;
  discountPaise?: number;
  comments?: string | null;
}

export interface InvoiceDraftResponse {
  invoiceId: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  status: string;
  type: string;
}

export interface InvoiceIssueResponse {
  invoiceId: string;
  pdfUrl: string;
  status: string;
}
