import { Controller, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { Role } from '@shared/enums';
import { AGENT_ROLE } from '../../common/agent-role';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { AdminPaymentsService } from '../services/admin-payments.service';
import { UpdatePaymentDto } from '../dto/update-payment.dto';

@Controller('admin/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BILLING, Role.OPS, AGENT_ROLE)
export class AdminPaymentsController {
  constructor(private readonly adminPaymentsService: AdminPaymentsService) {}

  @Patch(':id/payment')
  async updatePayment(@Param('id') orderId: string, @Body() dto: UpdatePaymentDto) {
    return this.adminPaymentsService.updateStatus(orderId, {
      provider: dto.provider,
      status: dto.status,
      amountPaise: dto.amountPaise,
      note: dto.note,
    });
  }
}
