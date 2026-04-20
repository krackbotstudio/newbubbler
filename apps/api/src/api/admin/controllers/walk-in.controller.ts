import { Controller, Get, Post, Body, Query, Req, UseGuards, BadRequestException } from '@nestjs/common';
import { Role } from '@shared/enums';
import { AGENT_ROLE } from '../../common/agent-role';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import type { AuthUser } from '../../common/roles.guard';
import { resolveScopedBranchId } from '../../common/branch-scope.util';
import { WalkInService } from '../services/walk-in.service';
import { WalkInCustomerLookupQueryDto } from '../dto/walk-in-customer-lookup-query.dto';
import { CreateWalkInCustomerDto } from '../dto/create-walk-in-customer.dto';
import { CreateWalkInOrderDto } from '../dto/create-walk-in-order.dto';

@Controller('admin/walk-in')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.PARTIAL_ADMIN, Role.OPS, Role.BILLING, AGENT_ROLE)
export class WalkInController {
  constructor(private readonly walkInService: WalkInService) {}

  @Get('customer')
  async lookupCustomer(@Query() query: WalkInCustomerLookupQueryDto) {
    const customer = await this.walkInService.lookupCustomer(query.phone);
    return { customer: customer ?? null };
  }

  @Post('customer')
  async createCustomer(@Body() body: CreateWalkInCustomerDto) {
    const customer = await this.walkInService.createCustomer(
      body.phone,
      body.name,
      body.email,
    );
    return { customer };
  }

  @Post('orders')
  async createOrder(@Body() body: CreateWalkInOrderDto, @Req() req: { user: AuthUser }) {
    const u = req.user;
    const branchId = resolveScopedBranchId(u, body.branchId);
    if (!branchId) {
      throw new BadRequestException('Branch is required for walk-in order');
    }
    const order = await this.walkInService.createOrder(body.userId, branchId);
    return { order: { id: order.id } };
  }
}
