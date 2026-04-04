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
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
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
  filename?: string;
  originalname?: string;
}

function sanitizeOriginalName(name: string): string {
  return (name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'file';
}

function extFromName(name: string): string {
  const clean = sanitizeOriginalName(name);
  const ext = path.extname(clean).toLowerCase();
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') return ext;
  return '.png';
}

function resolveApiAssetsRoot(): string {
  const cwd = process.cwd();
  const monorepoApiRoot = path.resolve(cwd, 'apps', 'api');
  const apiRoot = fs.existsSync(path.join(monorepoApiRoot, 'src'))
    ? monorepoApiRoot
    : cwd;
  const assetsRoot = path.join(apiRoot, 'assets');
  if (!fs.existsSync(assetsRoot)) fs.mkdirSync(assetsRoot, { recursive: true });
  return assetsRoot;
}

function brandingMulterOptions(prefix: string) {
  const destination = path.join(resolveApiAssetsRoot(), 'branding');
  if (!fs.existsSync(destination)) fs.mkdirSync(destination, { recursive: true });
  const stableBase = prefix || 'logo-';
  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, destination),
      filename: (_req, file, cb) => {
        const ext = extFromName(file.originalname);
        const finalName = `${stableBase}${ext}`;
        try {
          for (const existing of fs.readdirSync(destination)) {
            if (existing.startsWith(stableBase) && existing !== finalName) {
              fs.unlinkSync(path.join(destination, existing));
            }
          }
        } catch {
          // best-effort cleanup only
        }
        cb(null, finalName);
      },
    }),
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
  @UseInterceptors(FileInterceptor('file', brandingMulterOptions('logo')))
  async uploadLogo(@UploadedFile() file: MulterUploadFile) {
    if (!file?.filename) {
      throw new BadRequestException('File is required');
    }
    return this.adminBrandingService.uploadLogo(file.filename);
  }

  @Post('upi-qr')
  @Roles(Role.ADMIN, Role.BILLING)
  @UseInterceptors(FileInterceptor('file', brandingMulterOptions('upi-qr')))
  async uploadUpiQr(@UploadedFile() file: MulterUploadFile) {
    if (!file?.filename) {
      throw new BadRequestException('File is required');
    }
    return this.adminBrandingService.uploadUpiQr(file.filename);
  }

  @Post('welcome-background')
  @Roles(Role.ADMIN, Role.BILLING)
  @UseInterceptors(FileInterceptor('file', brandingMulterOptions('welcome-bg')))
  async uploadWelcomeBackground(@UploadedFile() file: MulterUploadFile) {
    if (!file?.filename) {
      throw new BadRequestException('File is required');
    }
    return this.adminBrandingService.uploadWelcomeBackground(file.filename);
  }

  @Post('app-icon')
  @Roles(Role.ADMIN, Role.BILLING)
  @UseInterceptors(FileInterceptor('file', brandingMulterOptions('app-icon')))
  async uploadAppIcon(@UploadedFile() file: MulterUploadFile) {
    if (!file?.filename) {
      throw new BadRequestException('File is required');
    }
    return this.adminBrandingService.uploadAppIcon(file.filename);
  }
}
