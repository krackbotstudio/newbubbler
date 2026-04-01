/**
 * Presets supported by GET /admin/analytics/revenue (use exact strings backend expects).
 * CUSTOM is UI-only: when selected, use dateFrom/dateTo instead of preset.
 */
export type AnalyticsPreset =
  | 'TODAY'
  | 'THIS_MONTH'
  | 'LAST_1_MONTH'
  | 'LAST_3_MONTHS'
  | 'LAST_6_MONTHS'
  | 'LAST_12_MONTHS'
  | 'THIS_YEAR'
  | 'LAST_YEAR'
  | 'FY25'
  | 'FY26'
  | 'FY27'
  | 'CUSTOM';

export interface AnalyticsTotals {
  billedPaise: number;
  collectedPaise: number;
  taxPaise: number;
  discountPaise: number;
  ordersCount: number;
  invoicesCount: number;
}

/** One point in the breakdown (chart/table row). Backend may use "key" as dateKey. */
export interface AnalyticsPoint {
  dateKey: string;
  billedPaise: number;
  collectedPaise: number;
}

/**
 * Response from GET /admin/analytics/revenue.
 * Backend returns totals at top level + breakdown array (each item has key, billedPaise, collectedPaise, ...).
 */
export interface AnalyticsResponse {
  billedPaise: number;
  collectedPaise: number;
  taxPaise: number;
  discountPaise: number;
  ordersCount: number;
  invoicesCount: number;
  orderCategories: {
    online: number;
    walkin: number;
    subscription: number;
    cancelled: number;
  };
  breakdown: Array<{
    key: string;
    billedPaise: number;
    collectedPaise: number;
    ordersCount?: number;
    invoicesCount?: number;
  }>;
}

/** Map breakdown item to AnalyticsPoint (key -> dateKey). */
export function toAnalyticsPoints(breakdown: AnalyticsResponse['breakdown']): AnalyticsPoint[] {
  return (breakdown ?? []).map((p) => ({
    dateKey: p.key,
    billedPaise: p.billedPaise,
    collectedPaise: p.collectedPaise,
  }));
}

/** Response from GET /admin/analytics/dashboard-kpis. */
export interface DashboardKpisResponse {
  activeSubscriptionsCount: number;
  totalCustomersCount: number;
}

export interface CompletedCatalogItemQuantity {
  itemName: string;
  segment: string;
  service: string;
  quantity: number;
}
