import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@shared/enums';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthUser } from '../../common/roles.guard';
import { UpsertCustomerPortalDto } from '../dto/upsert-customer-portal.dto';
import { AdminCustomerPortalsService } from '../services/admin-customer-portals.service';

interface MulterUploadFile {
  buffer?: Buffer;
  originalname?: string;
  mimetype?: string;
}

@Controller('admin/customer-portals')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.PARTIAL_ADMIN, Role.OPS)
export class AdminCustomerPortalsController {
  constructor(private readonly service: AdminCustomerPortalsService) {}

  @Get('branch/:branchId')
  async getByBranch(@CurrentUser() user: AuthUser, @Param('branchId') branchId: string) {
    return this.service.getPortalForBranch(user, branchId);
  }

  @Put('branch/:branchId')
  async upsertByBranch(
    @CurrentUser() user: AuthUser,
    @Param('branchId') branchId: string,
    @Body() dto: UpsertCustomerPortalDto,
  ) {
    return this.service.upsertPortalForBranch(user, branchId, dto);
  }

  @Post('branch/:branchId/logo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @CurrentUser() user: AuthUser,
    @Param('branchId') branchId: string,
    @UploadedFile() file: MulterUploadFile,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('File is required');
    return this.service.uploadLogo(
      user,
      branchId,
      file as { buffer: Buffer; originalname?: string; mimetype?: string },
    );
  }

  @Post('branch/:branchId/app-icon')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAppIcon(
    @CurrentUser() user: AuthUser,
    @Param('branchId') branchId: string,
    @UploadedFile() file: MulterUploadFile,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('File is required');
    return this.service.uploadAppIcon(
      user,
      branchId,
      file as { buffer: Buffer; originalname?: string; mimetype?: string },
    );
  }

  @Post('branch/:branchId/carousel/:position')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCarousel(
    @CurrentUser() user: AuthUser,
    @Param('branchId') branchId: string,
    @Param('position') position: string,
    @UploadedFile() file: MulterUploadFile,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('File is required');
    const pos = Number.parseInt(position, 10);
    if (!Number.isFinite(pos) || pos < 1 || pos > 10) {
      throw new BadRequestException('Position must be 1..10');
    }
    return this.service.setCarouselImage(
      user,
      branchId,
      pos,
      file as { buffer: Buffer; originalname?: string; mimetype?: string },
    );
  }
}

