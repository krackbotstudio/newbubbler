import { Inject, Injectable } from '@nestjs/common';
import { getRevenueAnalytics } from '../../../application/analytics/revenue-analytics.use-case';
import type { RevenuePreset } from '../../../application/time/analytics-date';
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

  async getDashboardKpis(): Promise<{ activeSubscriptionsCount: number; totalCustomersCount: number }> {
    const [activeSubscriptionsCount, totalCustomersCount] = await Promise.all([
      this.subscriptionsRepo.countActive(),
      this.customersRepo.count(),
    ]);
    return { activeSubscriptionsCount, totalCustomersCount };
  }
}
