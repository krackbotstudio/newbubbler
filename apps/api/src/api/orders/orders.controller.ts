import { Controller, Get, Param, Patch, Body, Post, UseGuards } from '@nestjs/common';
import { OrderStatus, Role } from '@shared/enums';
import { AGENT_ROLE } from '../common/agent-role';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/roles.guard';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-status.dto';
import { OrderFeedbackDto } from './dto/order-feedback.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @Roles(Role.CUSTOMER)
  async createOrder(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto) {
    const result = await this.ordersService.createForCustomer(user, {
      orderType: dto.orderType,
      serviceType: dto.serviceType,
      services: dto.services,
      selectedServices: dto.selectedServices,
      addressId: dto.addressId,
      pickupDate: dto.pickupDate,
      timeWindow: dto.timeWindow,
      estimatedWeightKg: dto.estimatedWeightKg,
      subscriptionId: dto.subscriptionId,
      branchId: dto.branchId,
    });
    return result;
  }

  @Get()
  @Roles(Role.CUSTOMER)
  async listOrders(@CurrentUser() user: AuthUser) {
    const orders = await this.ordersService.listForCustomer(user);
    return orders.map((o) => {
      const ext = o as {
        amountToPayPaise?: number | null;
        subscriptionUsageKg?: number | null;
        subscriptionUsageItems?: number | null;
      };
      return {
        id: o.id,
        status: o.status,
        serviceType: o.serviceType,
        orderType: o.orderType,
        orderSource: (o as { orderSource?: string | null }).orderSource ?? null,
        subscriptionId: (o as { subscriptionId?: string | null }).subscriptionId ?? null,
        pickupDate: o.pickupDate,
        timeWindow: o.timeWindow,
        createdAt: o.createdAt,
        amountToPayPaise: ext.amountToPayPaise ?? null,
        paymentStatus: o.paymentStatus,
        addressId: o.addressId,
        subscriptionUsageKg: ext.subscriptionUsageKg ?? null,
        subscriptionUsageItems: ext.subscriptionUsageItems ?? null,
      };
    });
  }

  @Get(':id/invoices')
  @Roles(Role.CUSTOMER)
  async listOrderInvoices(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ordersService.listInvoicesForOrder(id, user);
  }

  @Get(':id')
  @Roles(Role.CUSTOMER, Role.ADMIN, Role.OPS, Role.BILLING, AGENT_ROLE)
  async getOrder(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const order = await this.ordersService.getOrderForUser(user, id);
    return order;
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN, Role.OPS, AGENT_ROLE)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    const result = await this.ordersService.updateStatusAsAdmin(id, dto.status as OrderStatus, {
      cancellationReason: dto.reason,
    });
    return result;
  }

  @Get(':id/feedback/eligibility')
  @Roles(Role.CUSTOMER)
  async getFeedbackEligibility(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ordersService.getFeedbackEligibility(id, user);
  }

  @Post(':id/feedback')
  @Roles(Role.CUSTOMER)
  async submitOrderFeedback(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: OrderFeedbackDto,
  ) {
    const feedback = await this.ordersService.submitOrderFeedback(id, user, {
      rating: dto.rating,
      tags: dto.tags,
      message: dto.message,
    });
    return {
      id: feedback.id,
      orderId: feedback.orderId,
      type: feedback.type,
      rating: feedback.rating,
      status: feedback.status,
      createdAt: feedback.createdAt,
    };
  }
}

