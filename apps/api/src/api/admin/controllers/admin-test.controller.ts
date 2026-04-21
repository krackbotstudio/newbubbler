import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@shared/enums';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { prisma } from '../../../infra/prisma/prisma-client';

const SEEDED_PHONE = process.env.SEEDED_CUSTOMER_PHONE ?? '+919999999999';

/**
 * Dev/test helper: returns seeded customer's addressId (and userId).
 * Subscription flows were removed; `subscriptionId` is always null for API compatibility.
 */
@Controller('admin/test')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BILLING, Role.OPS)
export class AdminTestController {
  @Get('seeded-customer-ids')
  async getSeededCustomerIds(
    @Query('phone') phoneQuery?: string,
  ): Promise<{
    addressId: string;
    subscriptionId: null;
    userId: string;
  } | { error: string }> {
    const phone = (phoneQuery?.trim() || SEEDED_PHONE);
    const user = await prisma.user.findFirst({
      where: { phone, role: 'CUSTOMER' },
    });
    if (!user) {
      return { error: 'Seeded customer not found. Run prisma:seed.' };
    }
    const address = await prisma.address.findFirst({
      where: { userId: user.id, isDefault: true },
    });
    if (!address) {
      return { error: 'Seeded customer has no default address.' };
    }
    return {
      userId: user.id,
      addressId: address.id,
      subscriptionId: null,
    };
  }
}
