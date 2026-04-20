import { Controller, Get, Patch, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@shared/enums';

function phoneDigitCount(phone: string): number {
  return (phone || '').replace(/\D/g, '').length;
}
import { AGENT_ROLE } from '../../common/agent-role';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import type { AuthUser } from '../../common/roles.guard';
import { resolveScopedBranchId } from '../../common/branch-scope.util';
import { AdminCustomersService } from '../services/admin-customers.service';
import { PatchCustomerDto } from '../dto/patch-customer.dto';

@Controller('admin/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.PARTIAL_ADMIN, Role.OPS, Role.BILLING, AGENT_ROLE)
export class AdminCustomersController {
  constructor(private readonly adminCustomersService: AdminCustomersService) {}

  @Get()
  async list(
    @Req() req: { user: AuthUser },
    @Query('limit') limitStr?: string,
    @Query('cursor') cursor?: string,
    @Query('search') search?: string,
    @Query('branchId') branchIdQuery?: string,
  ) {
    const limit = Math.min(Math.max(parseInt(limitStr ?? '20', 10) || 20, 1), 100);
    const user = req.user;
    /** Branch heads (OPS): list customers who have at least one order attributed to this branch (same rules as admin orders). */
    if (user.role === Role.OPS) {
      if (!user.branchId) {
        return { data: [], nextCursor: null };
      }
      return this.adminCustomersService.listWithCounts(
        limit,
        cursor ?? null,
        search?.trim() || null,
        user.branchId,
      );
    }
    const branchId = resolveScopedBranchId(user, branchIdQuery) ?? null;
    return this.adminCustomersService.listWithCounts(limit, cursor ?? null, search?.trim() || null, branchId);
  }

  @Get('search')
  async search(@Query('phone') phone: string, @Req() req: { user: AuthUser }) {
    const u = req.user;
    if (u.role === Role.OPS && phoneDigitCount(phone) < 10) {
      return [];
    }
    /** OPS / agents: phone search is global (all branches). Counts are totals across the account. */
    const branchId = u.role === AGENT_ROLE && u.branchId ? u.branchId : null;
    return this.adminCustomersService.searchByPhoneWithCounts(phone || '', branchId);
  }

  @Get('count')
  async count(@Req() req: { user: AuthUser }, @Query('branchId') branchIdQuery?: string) {
    const user = req.user;
    const branchId = user.role === Role.OPS ? user.branchId ?? null : resolveScopedBranchId(user, branchIdQuery) ?? null;
    return this.adminCustomersService.countForDashboard(branchId);
  }

  @Get(':userId/payments')
  @Roles(Role.ADMIN, Role.PARTIAL_ADMIN, Role.OPS, Role.BILLING, AGENT_ROLE)
  async getPayments(
    @Param('userId') userId: string,
    @Query('branchId') branchIdQuery: string | undefined,
    @Req() req: { user: AuthUser },
  ) {
    const branchId = resolveScopedBranchId(req.user, branchIdQuery);
    return this.adminCustomersService.getPayments(userId, branchId);
  }

  @Get(':userId/subscription-orders')
  @Roles(Role.ADMIN, Role.PARTIAL_ADMIN, Role.OPS, Role.BILLING, AGENT_ROLE)
  async getSubscriptionOrders(@Param('userId') userId: string, @Req() req: { user: AuthUser }) {
    const branchId = resolveScopedBranchId(req.user);
    return this.adminCustomersService.getSubscriptionOrders(userId, branchId);
  }

  @Get(':userId')
  @Roles(Role.ADMIN, Role.PARTIAL_ADMIN, Role.OPS, Role.BILLING, AGENT_ROLE)
  async get(@Param('userId') userId: string, @Req() req: { user: AuthUser }) {
    const branchId = resolveScopedBranchId(req.user);
    return this.adminCustomersService.get(userId, branchId);
  }

  @Patch(':userId')
  @Roles(Role.ADMIN)
  async update(@Param('userId') userId: string, @Body() dto: PatchCustomerDto) {
    return this.adminCustomersService.update(userId, {
      name: dto.name,
      email: dto.email,
      notes: dto.notes,
    });
  }
}
