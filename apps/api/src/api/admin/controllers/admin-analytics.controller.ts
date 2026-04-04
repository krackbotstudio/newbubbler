import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@shared/enums';
import { AGENT_ROLE } from '../../common/agent-role';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import type { AuthUser } from '../../common/roles.guard';
import { isBranchScopedStaffRole } from '../../common/branch-scope.util';
import { AdminAnalyticsService } from '../services/admin-analytics.service';
import { RevenueQueryDto } from '../dto/revenue-query.dto';
import type { RevenuePreset } from '../../../application/time/analytics-date';

const PRESETS: RevenuePreset[] = [
  'TODAY', 'THIS_MONTH', 'LAST_1_MONTH', 'LAST_3_MONTHS', 'LAST_6_MONTHS',
  'LAST_12_MONTHS', 'THIS_YEAR', 'LAST_YEAR', 'FY25', 'FY26', 'FY27',
];

@Controller('admin/analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BILLING, Role.OPS, AGENT_ROLE)
export class AdminAnalyticsController {
  constructor(private readonly adminAnalyticsService: AdminAnalyticsService) {}

  @Get('revenue')
  async getRevenue(@Query() query: RevenueQueryDto, @Req() req: { user: AuthUser }) {
    const preset = query.preset && PRESETS.includes(query.preset as RevenuePreset)
      ? (query.preset as RevenuePreset)
      : undefined;
    const user = req.user;
    const branchFromQuery = query.branchId ? String(query.branchId) : undefined;
    const branchId =
      isBranchScopedStaffRole(user.role) && user.branchId ? user.branchId : branchFromQuery;
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
  async getCompletedCatalogItems(@Query() query: RevenueQueryDto, @Req() req: { user: AuthUser }) {
    const preset = query.preset && PRESETS.includes(query.preset as RevenuePreset)
      ? (query.preset as RevenuePreset)
      : undefined;
    const user = req.user;
    const branchFromQuery = query.branchId ? String(query.branchId) : undefined;
    const branchId =
      isBranchScopedStaffRole(user.role) && user.branchId ? user.branchId : branchFromQuery;
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
  async getDashboardKpis(@Req() req: { user: AuthUser }) {
    const user = req.user;
    if (isBranchScopedStaffRole(user.role) && user.branchId) {
      return this.adminAnalyticsService.getDashboardKpisForBranch(user.branchId);
    }
    return this.adminAnalyticsService.getDashboardKpis();
  }
}
