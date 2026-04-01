export interface RevenueBreakdownItem {
  /** Date key (YYYY-MM-DD) or month key (YYYY-MM) */
  key: string;
  billedPaise: number;
  collectedPaise: number;
  ordersCount: number;
  invoicesCount: number;
}

export interface RevenueResult {
  billedPaise: number;
  collectedPaise: number;
  taxPaise: number;
  discountPaise: number;
  ordersCount: number;
  invoicesCount: number;
  /**
   * Pie chart categories for orders within the same date range.
   * Categories are partitioned to avoid overlaps for percentage math:
   * - Cancelled: status === CANCELLED
   * - Subscription: non-cancelled AND orderType in SUBSCRIPTION/BOTH
   * - Online: non-cancelled AND non-subscription AND orderSource === ONLINE
   * - Walkin: non-cancelled AND non-subscription AND orderSource !== ONLINE (incl null)
   */
  orderCategories: {
    online: number;
    walkin: number;
    subscription: number;
    cancelled: number;
  };
  breakdown: RevenueBreakdownItem[];
}

export interface CompletedCatalogItemQuantity {
  itemName: string;
  segment: string;
  service: string;
  quantity: number;
}

export interface AnalyticsRepo {
  getRevenue(
    dateFrom: Date,
    dateTo: Date,
    breakdownKind: 'daily' | 'monthly',
    branchId?: string,
  ): Promise<RevenueResult>;
  getCompletedCatalogItemQuantities(
    dateFrom: Date,
    dateTo: Date,
    branchId?: string,
  ): Promise<CompletedCatalogItemQuantity[]>;
}
