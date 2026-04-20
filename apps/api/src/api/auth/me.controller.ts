import { Body, Controller, Get, Patch, Post, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { Role } from '@shared/enums';
import { MeService } from './me.service';
import type { AuthUser } from '../common/roles.guard';
import { UpdateMeDto } from './dto/update-me.dto';
import { PushTokenDto } from './dto/push-token.dto';

/**
 * GET /api/me — CUSTOMER-only. Returns caller's data including name, email.
 * PATCH /api/me — CUSTOMER-only. Update name and/or email.
 * POST /api/me/push-token — CUSTOMER-only. Register Expo push token for lock-screen notifications.
 */
@Controller('me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER)
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  getMe(
    @CurrentUser() user: AuthUser | undefined,
    @Req() req: { headers?: { host?: string; 'x-forwarded-host'?: string; 'x-portal-slug'?: string } },
  ) {
    if (!user) throw new UnauthorizedException();
    const host = req.headers?.['x-forwarded-host'] ?? req.headers?.host;
    const slugHint = req.headers?.['x-portal-slug'];
    return this.meService.getMe(user, host, slugHint);
  }

  @Patch()
  updateMe(@CurrentUser() user: AuthUser | undefined, @Body() dto: UpdateMeDto) {
    if (!user) throw new UnauthorizedException();
    return this.meService.updateMe(user, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.email !== undefined && { email: dto.email }),
    });
  }

  @Post('push-token')
  registerPushToken(@CurrentUser() user: AuthUser | undefined, @Body() dto: PushTokenDto) {
    if (!user) throw new UnauthorizedException();
    return this.meService.registerPushToken(user, dto.pushToken);
  }
}
