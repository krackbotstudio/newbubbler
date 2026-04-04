import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { Role } from '@shared/enums';
import { AGENT_ROLE } from '../../common/agent-role';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { AdminInvoicesService } from '../services/admin-invoices.service';
import { InvoiceDraftDto } from '../dto/invoice-draft.dto';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OPS, Role.BILLING, AGENT_ROLE)
export class AdminInvoicesController {
  constructor(private readonly adminInvoicesService: AdminInvoicesService) {}

  @Post(':id/ack-invoice/draft')
  async createAckDraft(@Param('id') orderId: string, @Body() dto: InvoiceDraftDto) {
    const result = await this.adminInvoicesService.createAckDraft(orderId, {
      orderMode: dto.orderMode,
      items: dto.items.map((i) => ({
        type: i.type,
        name: i.name,
        quantity: i.quantity,
        unitPricePaise: i.unitPricePaise,
        amountPaise: i.amountPaise,
        catalogItemId: i.catalogItemId,
        segmentCategoryId: i.segmentCategoryId,
        serviceCategoryId: i.serviceCategoryId,
      })),
      taxPaise: dto.taxPaise,
      discountPaise: dto.discountPaise,
      subscriptionUtilized: dto.subscriptionUtilized,
      subscriptionId: dto.subscriptionId,
      subscriptionUsageKg: dto.subscriptionUsageKg,
      subscriptionUsageItems: dto.subscriptionUsageItems,
      subscriptionUsageSubscriptionIds: dto.subscriptionUsageSubscriptionIds,
      newSubscription: dto.newSubscription,
      newSubscriptions: dto.newSubscriptions,
      comments: dto.comments,
    });
    return {
      invoiceId: result.invoiceId,
      subtotal: result.subtotal,
      tax: result.tax,
      total: result.total,
      status: 'DRAFT',
      type: 'ACKNOWLEDGEMENT',
    };
  }

  @Post(':id/ack-invoice/issue')
  async issueAck(
    @Param('id') orderId: string,
    @Body() body: { applySubscription?: boolean; weightKg?: number; itemsCount?: number },
  ) {
    return this.adminInvoicesService.issueAck(orderId, {
      applySubscription: body?.applySubscription,
      weightKg: body?.weightKg,
      itemsCount: body?.itemsCount,
    });
  }

  @Post(':id/final-invoice/draft')
  async createFinalDraft(@Param('id') orderId: string, @Body() dto: InvoiceDraftDto) {
    const result = await this.adminInvoicesService.createFinalDraft(orderId, {
      items: dto.items.map((i) => ({
        type: i.type,
        name: i.name,
        quantity: i.quantity,
        unitPricePaise: i.unitPricePaise,
        amountPaise: i.amountPaise,
        catalogItemId: i.catalogItemId,
        segmentCategoryId: i.segmentCategoryId,
        serviceCategoryId: i.serviceCategoryId,
      })),
      taxPaise: dto.taxPaise,
      discountPaise: dto.discountPaise,
      comments: dto.comments,
      subscriptionUsageKg: dto.subscriptionUsageKg,
      subscriptionUsageItems: dto.subscriptionUsageItems,
    });
    return {
      invoiceId: result.invoiceId,
      subtotal: result.subtotal,
      tax: result.tax,
      total: result.total,
      status: 'DRAFT',
      type: 'FINAL',
    };
  }

  @Post(':id/final-invoice/issue')
  async issueFinal(@Param('id') orderId: string) {
    return this.adminInvoicesService.issueFinal(orderId);
  }

  @Post(':id/regenerate-pdf')
  async regeneratePdf(
    @Param('id') orderId: string,
    @Body() body: { type?: 'ACK' | 'FINAL' },
  ) {
    return this.adminInvoicesService.regeneratePdf(orderId, body?.type);
  }
}
