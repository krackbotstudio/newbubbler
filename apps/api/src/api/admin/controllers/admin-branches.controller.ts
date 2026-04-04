import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
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
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { AdminBranchesService } from '../services/admin-branches.service';
import { CreateBranchDto } from '../dto/create-branch.dto';
import { UpdateBranchDto } from '../dto/update-branch.dto';

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

function branchBrandingMulterOptions(kind: 'logo' | 'upi-qr') {
  const destination = path.join(resolveApiAssetsRoot(), 'branding', 'branches');
  if (!fs.existsSync(destination)) fs.mkdirSync(destination, { recursive: true });
  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, destination),
      filename: (req, file, cb) => {
        const branchId = String(req.params?.id ?? 'branch');
        const base = `branch-${branchId}-${kind}`;
        const ext = extFromName(file.originalname);
        const finalName = `${base}${ext}`;
        try {
          for (const existing of fs.readdirSync(destination)) {
            if (existing.startsWith(base) && existing !== finalName) {
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

@Controller('admin/branches')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BILLING, Role.OPS, AGENT_ROLE)
export class AdminBranchesController {
  constructor(private readonly adminBranchesService: AdminBranchesService) {}

  @Get()
  @Roles(Role.ADMIN, Role.BILLING, Role.OPS, AGENT_ROLE)
  async list() {
    return this.adminBranchesService.list();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.BILLING, Role.OPS, AGENT_ROLE)
  async getById(@Param('id') id: string) {
    return this.adminBranchesService.getById(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.BILLING)
  async create(@Body() dto: CreateBranchDto) {
    return this.adminBranchesService.create({
      name: dto.name,
      address: dto.address,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      gstNumber: dto.gstNumber ?? null,
      panNumber: dto.panNumber ?? null,
      footerNote: dto.footerNote ?? null,
      upiId: dto.upiId ?? null,
      upiPayeeName: dto.upiPayeeName ?? null,
      upiLink: dto.upiLink ?? null,
      isDefault: dto.isDefault,
    });
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.BILLING)
  async update(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.adminBranchesService.update(id, {
      name: dto.name,
      address: dto.address,
      phone: dto.phone,
      email: dto.email,
      gstNumber: dto.gstNumber,
      panNumber: dto.panNumber,
      footerNote: dto.footerNote,
      upiId: dto.upiId,
      upiPayeeName: dto.upiPayeeName,
      upiLink: dto.upiLink,
      isDefault: dto.isDefault,
    });
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.BILLING)
  async delete(@Param('id') id: string) {
    await this.adminBranchesService.delete(id);
    return { success: true };
  }

  @Post(':id/logo')
  @Roles(Role.ADMIN, Role.BILLING)
  @UseInterceptors(FileInterceptor('file', branchBrandingMulterOptions('logo')))
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: MulterUploadFile,
  ) {
    if (!file?.filename) {
      throw new BadRequestException('File is required');
    }
    return this.adminBranchesService.uploadLogo(id, file.filename);
  }

  @Post(':id/upi-qr')
  @Roles(Role.ADMIN, Role.BILLING)
  @UseInterceptors(FileInterceptor('file', branchBrandingMulterOptions('upi-qr')))
  async uploadUpiQr(
    @Param('id') id: string,
    @UploadedFile() file: MulterUploadFile,
  ) {
    if (!file?.filename) {
      throw new BadRequestException('File is required');
    }
    return this.adminBranchesService.uploadUpiQr(id, file.filename);
  }
}
