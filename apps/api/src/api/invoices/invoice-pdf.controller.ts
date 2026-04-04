import { Controller, Get, Param, UseGuards, Res } from '@nestjs/common';
import { Role } from '@shared/enums';
import { AGENT_ROLE } from '../common/agent-role';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CurrentUser } from '../common/current-user.decorator';
import type { AuthUser } from '../common/roles.guard';
import { InvoicePdfService } from './invoice-pdf.service';

/**
 * PDF streaming for an invoice. Allowed: ADMIN, BILLING, OPS, or CUSTOMER (owner of order).
 */
@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BILLING, Role.OPS, AGENT_ROLE, Role.CUSTOMER)
export class InvoicePdfController {
  constructor(private readonly invoicePdfService: InvoicePdfService) {}

  @Get(':invoiceId/pdf')
  async getPdf(
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { stream, contentType } = await this.invoicePdfService.getStream(invoiceId, user);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="invoice-${invoiceId}.pdf"`);
    stream.pipe(res);
  }
}
