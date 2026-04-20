import { Inject, Injectable } from '@nestjs/common';
import { getRevenueAnalytics } from '../../../application/analytics/revenue-analytics.use-case';
import type { RevenuePreset } from '../../../application/time/analytics-date';
import { getRevenueDateRange, getRevenueDateRangeCustom } from '../../../application/time/analytics-date';
import { AppError } from '../../../application/errors';
import type { AnalyticsRepo, SubscriptionsRepo, CustomersRepo } from '../../../application/ports';
import { ANALYTICS_REPO, SUBSCRIPTIONS_REPO, CUSTOMERS_REPO } from '../../../infra/infra.module';

@Injectable()
export class AdminAnalyticsService {
  constructor(
    @Inject(ANALYTICS_REPO)
    private readonly analyticsRepo: AnalyticsRepo,
    @Inject(SUBSCRIPTIONS_REPO)
    private readonly subscriptionsRepo: SubscriptionsRepo,
    @Inject(CUSTOMERS_REPO)
    private readonly customersRepo: CustomersRepo,
  ) {}

  async getRevenue(input: { preset?: RevenuePreset; branchId?: string; dateFrom?: Date; dateTo?: Date }) {
    return getRevenueAnalytics(input, { analyticsRepo: this.analyticsRepo });
  }

  async getCompletedCatalogItems(input: { preset?: RevenuePreset; branchId?: string; dateFrom?: Date; dateTo?: Date }) {
    let dateFrom: Date;
    let dateTo: Date;
    if (input.preset != null) {
      const range = getRevenueDateRange(input.preset);
      dateFrom = range.dateFrom;
      dateTo = range.dateTo;
    } else if (input.dateFrom != null && input.dateTo != null) {
      try {
        const range = getRevenueDateRangeCustom(input.dateFrom, input.dateTo);
        dateFrom = range.dateFrom;
        dateTo = range.dateTo;
      } catch {
        throw new AppError('ANALYTICS_INVALID_RANGE', 'Invalid date range: dateFrom must be before dateTo');
      }
    } else {
      const range = getRevenueDateRange('TODAY');
      dateFrom = range.dateFrom;
      dateTo = range.dateTo;
    }

    return this.analyticsRepo.getCompletedCatalogItemQuantities(dateFrom, dateTo, input.branchId);
  }

  async getDashboardKpis(input?: { branchId?: string | null }): Promise<{
    activeSubscriptionsCount: number;
    totalCustomersCount: number;
  }> {
    const branchId = input?.branchId?.trim() ? input.branchId.trim() : null;
    const [activeSubscriptionsCount, totalCustomersCount] = branchId
      ? await Promise.all([
          this.subscriptionsRepo.countActiveForBranch(branchId),
          this.customersRepo.countWithOrdersInBranch(branchId),
        ])
      : await Promise.all([
          this.subscriptionsRepo.countActive(),
          this.customersRepo.count(),
        ]);
    return { activeSubscriptionsCount, totalCustomersCount };
  }
}
