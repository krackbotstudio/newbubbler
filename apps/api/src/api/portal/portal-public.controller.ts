import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Role } from '@shared/enums';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import type { AuthUser } from '../common/roles.guard';
import { CurrentUser } from '../common/current-user.decorator';
import { PortalPublicService } from './portal-public.service';

@Controller('portal')
export class PortalPublicController {
  constructor(private readonly portalService: PortalPublicService) {}

  @Get('public')
  async getPublic(
    @Req()
    req: {
      headers?: { host?: string; 'x-forwarded-host'?: string; 'x-portal-slug'?: string };
    },
  ) {
    const host = req.headers?.['x-forwarded-host'] ?? req.headers?.host;
    const slugHint = req.headers?.['x-portal-slug'];
    return this.portalService.getPublicByHost(host, slugHint);
  }

  @Get('membership')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  async membership(
    @Req()
    req: {
      headers?: { host?: string; 'x-forwarded-host'?: string; 'x-portal-slug'?: string };
    },
    @CurrentUser() user: AuthUser,
  ) {
    const host = req.headers?.['x-forwarded-host'] ?? req.headers?.host;
    const slugHint = req.headers?.['x-portal-slug'];
    return this.portalService.membershipFromHost(host, user.id, slugHint);
  }

  @Post('membership/join')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  async join(
    @Req()
    req: {
      headers?: { host?: string; 'x-forwarded-host'?: string; 'x-portal-slug'?: string };
    },
    @CurrentUser() user: AuthUser,
  ) {
    const host = req.headers?.['x-forwarded-host'] ?? req.headers?.host;
    const slugHint = req.headers?.['x-portal-slug'];
    return this.portalService.joinFromHost(host, user.id, slugHint);
  }
}

