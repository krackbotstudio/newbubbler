import { AppError } from '../errors';
import type { AnalyticsRepo, RevenueResult } from '../ports';
import {
  getRevenueDateRange,
  getRevenueDateRangeCustom,
  type RevenuePreset,
} from '../time/analytics-date';

export interface RevenueAnalyticsDeps {
  analyticsRepo: AnalyticsRepo;
}

export interface RevenueAnalyticsInput {
  preset?: RevenuePreset;
  branchId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export async function getRevenueAnalytics(
  input: RevenueAnalyticsInput,
  deps: RevenueAnalyticsDeps,
): Promise<RevenueResult> {
  let dateFrom: Date;
  let dateTo: Date;
  let breakdownKind: 'daily' | 'monthly';

  if (input.preset != null) {
    const range = getRevenueDateRange(input.preset);
    dateFrom = range.dateFrom;
    dateTo = range.dateTo;
    breakdownKind = range.breakdownKind;
  } else if (input.dateFrom != null && input.dateTo != null) {
    try {
      const range = getRevenueDateRangeCustom(input.dateFrom, input.dateTo);
      dateFrom = range.dateFrom;
      dateTo = range.dateTo;
      breakdownKind = range.breakdownKind;
    } catch {
      throw new AppError('ANALYTICS_INVALID_RANGE', 'Invalid date range: dateFrom must be before dateTo');
    }
  } else {
    const range = getRevenueDateRange('TODAY');
    dateFrom = range.dateFrom;
    dateTo = range.dateTo;
    breakdownKind = range.breakdownKind;
  }

  return deps.analyticsRepo.getRevenue(dateFrom, dateTo, breakdownKind, input.branchId);
}
