import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@shared/enums';
import { AGENT_ROLE } from '../../common/agent-role';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import type { AuthUser } from '../../common/roles.guard';
import { AdminBrandingService } from '../services/admin-branding.service';
import { UpdateBrandingDto } from '../dto/update-branding.dto';

/** File from multer memory storage (used by FileInterceptor). */
interface MulterUploadFile {
  buffer?: Buffer;
  originalname?: string;
  mimetype?: string;
}

function asUploadedImage(file: MulterUploadFile): { buffer: Buffer; originalname?: string; mimetype?: string } {
  return {
    buffer: file.buffer as Buffer,
    originalname: file.originalname,
    mimetype: file.mimetype,
  };
}

@Controller('admin/branding')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BILLING, Role.OPS, AGENT_ROLE)
export class AdminBrandingController {
  constructor(private readonly adminBrandingService: AdminBrandingService) {}

  @Get()
  @Roles(Role.ADMIN, Role.BILLING, Role.OPS, AGENT_ROLE)
  async get() {
    return this.adminBrandingService.get();
  }

  @Put()
  @Roles(Role.ADMIN, Role.BILLING)
  async update(@CurrentUser() user: AuthUser, @Body() dto: UpdateBrandingDto) {
    const isSuperAdmin = user?.role === Role.ADMIN;
    return this.adminBrandingService.update({
      businessName: dto.businessName,
      address: dto.address,
      phone: dto.phone,
      footerNote: dto.footerNote ?? null,
      panNumber: dto.panNumber ?? null,
      gstNumber: dto.gstNumber ?? null,
      email: dto.email ?? null,
      upiId: dto.upiId ?? null,
      upiPayeeName: dto.upiPayeeName ?? null,
      upiLink: dto.upiLink ?? null,
      ...(isSuperAdmin && {
        termsAndConditions: dto.termsAndConditions ?? null,
        privacyPolicy: dto.privacyPolicy ?? null,
      }),
    });
  }

  @Post('logo')
  @Roles(Role.ADMIN, Role.BILLING)
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(@UploadedFile() file: MulterUploadFile) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }
    return this.adminBrandingService.uploadLogo(asUploadedImage(file));
  }

  @Post('upi-qr')
  @Roles(Role.ADMIN, Role.BILLING)
  @UseInterceptors(FileInterceptor('file'))
  async uploadUpiQr(@UploadedFile() file: MulterUploadFile) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }
    return this.adminBrandingService.uploadUpiQr(asUploadedImage(file));
  }

  @Post('welcome-background')
  @Roles(Role.ADMIN, Role.BILLING)
  @UseInterceptors(FileInterceptor('file'))
  async uploadWelcomeBackground(@UploadedFile() file: MulterUploadFile) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }
    return this.adminBrandingService.uploadWelcomeBackground(asUploadedImage(file));
  }

  @Post('app-icon')
  @Roles(Role.ADMIN, Role.BILLING)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAppIcon(@UploadedFile() file: MulterUploadFile) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }
    return this.adminBrandingService.uploadAppIcon(asUploadedImage(file));
  }
}
