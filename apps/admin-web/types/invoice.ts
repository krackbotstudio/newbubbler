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
  /** Piece count for dry-clean lines; omit or leave unset to treat as same as quantity. */
  clothesCount?: number;
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
