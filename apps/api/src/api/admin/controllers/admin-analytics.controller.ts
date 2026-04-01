import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@shared/enums';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { AdminAnalyticsService } from '../services/admin-analytics.service';
import { RevenueQueryDto } from '../dto/revenue-query.dto';
import type { RevenuePreset } from '../../../application/time/analytics-date';

const PRESETS: RevenuePreset[] = [
  'TODAY', 'THIS_MONTH', 'LAST_1_MONTH', 'LAST_3_MONTHS', 'LAST_6_MONTHS',
  'LAST_12_MONTHS', 'THIS_YEAR', 'LAST_YEAR', 'FY25', 'FY26', 'FY27',
];

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BILLING)
export class AdminAnalyticsController {
  constructor(private readonly adminAnalyticsService: AdminAnalyticsService) {}

  @Get('revenue')
  async getRevenue(@Query() query: RevenueQueryDto) {
    const preset = query.preset && PRESETS.includes(query.preset as RevenuePreset)
      ? (query.preset as RevenuePreset)
      : undefined;
    const branchId = query.branchId ? String(query.branchId) : undefined;
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
    const dateTo = query.dateTo ? new Date(query.dateTo) : undefined;
    return this.adminAnalyticsService.getRevenue({
      preset,
      branchId,
      dateFrom,
      dateTo,
    });
  }

  @Get('completed-catalog-items')
  async getCompletedCatalogItems(@Query() query: RevenueQueryDto) {
    const preset = query.preset && PRESETS.includes(query.preset as RevenuePreset)
      ? (query.preset as RevenuePreset)
      : undefined;
    const branchId = query.branchId ? String(query.branchId) : undefined;
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
    const dateTo = query.dateTo ? new Date(query.dateTo) : undefined;
    return this.adminAnalyticsService.getCompletedCatalogItems({
      preset,
      branchId,
      dateFrom,
      dateTo,
    });
  }

  @Get('dashboard-kpis')
  async getDashboardKpis() {
    return this.adminAnalyticsService.getDashboardKpis();
  }
}
