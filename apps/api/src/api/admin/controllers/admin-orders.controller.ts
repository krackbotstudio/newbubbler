import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { Role } from '@shared/enums';
import { AGENT_ROLE } from '../../common/agent-role';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import type { AuthUser } from '../../common/roles.guard';
import { effectiveBranchIdForAdminQuery } from '../../common/branch-scope.util';
import { AdminOrdersService } from '../services/admin-orders.service';
import { AdminListOrdersQueryDto } from '../dto/admin-list-orders-query.dto';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OPS, Role.BILLING, AGENT_ROLE)
export class AdminOrdersController {
  constructor(private readonly adminOrdersService: AdminOrdersService) {}

  @Get()
  async list(@Query() query: AdminListOrdersQueryDto, @Req() req: { user: AuthUser }) {
    const user = req.user as AuthUser;
    const limit = query.limit ?? 20;
    const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
    let dateTo: Date | undefined;
    if (query.dateTo) {
      dateTo = new Date(query.dateTo);
      dateTo.setHours(23, 59, 59, 999);
    }
    const pickupDateFrom = query.pickupDateFrom ? new Date(query.pickupDateFrom) : undefined;
    let pickupDateTo: Date | undefined;
    if (query.pickupDateTo) {
      pickupDateTo = new Date(query.pickupDateTo);
      pickupDateTo.setHours(23, 59, 59, 999);
    }
    const branchId = effectiveBranchIdForAdminQuery(user, query.branchId ?? null);
    const search = query.search?.trim() ? query.search.trim() : undefined;
    const filters = {
      status: query.status,
      pincode: query.pincode,
      serviceType: query.serviceType,
      customerId: query.customerId,
      branchId: branchId ?? null,
      orderSource: query.orderSource ?? null,
      search,
      dateFrom,
      dateTo,
      pickupDateFrom,
      pickupDateTo,
      limit: Math.min(limit, 200),
      cursor: query.cursor,
    };
    const result = await this.adminOrdersService.list(filters);
    return { data: result.data, nextCursor: result.nextCursor };
  }

  @Get(':id/summary')
  async getSummary(@Param('id') id: string) {
    return this.adminOrdersService.getSummary(id);
  }
}
