import { Controller, Get, Put, Post, Patch, Delete, Param, Body, Query, UseGuards, UseInterceptors, UploadedFile, BadRequestException, Req } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { Role } from '@shared/enums';
import { AGENT_ROLE } from '../../common/agent-role';
import type { Request } from 'express';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthUser } from '../../common/roles.guard';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { AdminCatalogService } from '../services/admin-catalog.service';
import { UpdateItemWithMatrixDto } from '../dto/update-item-with-matrix.dto';
import { CreateServiceCategoryDto } from '../dto/create-service-category.dto';
import { CreateSegmentCategoryDto } from '../dto/create-segment-category.dto';
import { PatchServiceCategoryDto } from '../dto/patch-service-category.dto';
import { PatchSegmentCategoryDto } from '../dto/patch-segment-category.dto';
import { ImportCatalogDto } from '../dto/import-catalog.dto';

interface MulterUploadFile {
  filename?: string;
  originalname?: string;
}

function sanitizeOriginalName(name: string): string {
  return (name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'icon';
}

function sanitizeIconKey(name: string): string {
  return (name || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'default';
}

function extFromName(name: string): string {
  const clean = sanitizeOriginalName(name);
  const ext = path.extname(clean).toLowerCase();
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') return ext;
  return '.png';
}

function resolveApiAssetsRoot(): string {
  const configuredRoot = process.env.LOCAL_STORAGE_ROOT?.trim();
  if (configuredRoot) {
    const root = path.resolve(configuredRoot);
    if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
    return root;
  }
  const cwd = process.cwd();
  const monorepoApiRoot = path.resolve(cwd, 'apps', 'api');
  const apiRoot = fs.existsSync(path.join(monorepoApiRoot, 'src'))
    ? monorepoApiRoot
    : cwd;
  const assetsRoot = path.join(apiRoot, 'assets');
  if (!fs.existsSync(assetsRoot)) fs.mkdirSync(assetsRoot, { recursive: true });
  return assetsRoot;
}

function catalogIconMulterOptions() {
  const destination = path.join(resolveApiAssetsRoot(), 'catalog-icons');
  if (!fs.existsSync(destination)) fs.mkdirSync(destination, { recursive: true });
  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, destination),
      filename: (req, file, cb) => {
        const key = sanitizeIconKey(String(req.query?.key ?? req.query?.itemId ?? 'default'));
        const base = `icon-${key}`;
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

@Controller('admin/catalog')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OPS, AGENT_ROLE)
export class AdminCatalogMatrixController {
  constructor(private readonly adminCatalogService: AdminCatalogService) {}

  @Get('prices/lookup')
  async getPriceLookup(
    @Query('itemId') itemId: string,
    @Query('segmentCategoryId') segmentCategoryId: string,
    @Query('serviceCategoryId') serviceCategoryId: string,
  ) {
    if (!itemId || !segmentCategoryId || !serviceCategoryId) {
      return { priceRupees: null };
    }
    const result = await this.adminCatalogService.getPriceLookup(
      itemId,
      segmentCategoryId,
      serviceCategoryId,
    );
    return result ?? { priceRupees: null };
  }

  @Get('items')
  async listWithMatrix(
    @Query('branchId') branchId: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.adminCatalogService.listItemsWithMatrix(user, branchId);
    return {
      items: result.items.map((item) => ({
        id: item.id,
        name: item.name,
        active: item.active,
        icon: (item as { icon?: string | null }).icon ?? null,
        branchIds: (item as { branchIds?: string[] }).branchIds ?? [],
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        segmentPrices: item.segmentPrices.map((p) => ({
          id: p.id,
          itemId: p.itemId,
          segmentCategoryId: p.segmentCategoryId,
          serviceCategoryId: p.serviceCategoryId,
          priceRupees: p.priceRupees,
          isActive: p.isActive,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
      })),
      serviceCategories: result.serviceCategories.map((c) => ({
        id: c.id,
        branchId: c.branchId,
        code: c.code,
        label: c.label,
        isActive: c.isActive,
        createdAt: c.createdAt,
      })),
      segmentCategories: result.segmentCategories.map((c) => ({
        id: c.id,
        branchId: c.branchId,
        code: c.code,
        label: c.label,
        isActive: c.isActive,
        createdAt: c.createdAt,
      })),
    };
  }

  @Put('items/:id')
  @Roles(Role.ADMIN, Role.OPS)
  async updateItemWithMatrix(
    @Param('id') id: string,
    @Body() dto: UpdateItemWithMatrixDto,
    @CurrentUser() user: AuthUser,
  ) {
    const result = await this.adminCatalogService.updateItemWithMatrix(
      id,
      {
        name: dto.name,
        active: dto.active,
        icon: dto.icon ?? null,
        branchIds: dto.branchIds,
        segmentPrices: dto.segmentPrices.map((p) => ({
          segmentCategoryId: p.segmentCategoryId,
          serviceCategoryId: p.serviceCategoryId,
          priceRupees: p.priceRupees,
          isActive: p.isActive ?? true,
        })),
      },
      user,
    );
    return {
      item: {
        id: result.item.id,
        name: result.item.name,
        active: result.item.active,
        icon: (result.item as { icon?: string | null }).icon ?? null,
        createdAt: result.item.createdAt,
        updatedAt: result.item.updatedAt,
      },
      segmentPrices: result.segmentPrices.map((p) => ({
        id: p.id,
        itemId: p.itemId,
        segmentCategoryId: p.segmentCategoryId,
        serviceCategoryId: p.serviceCategoryId,
        priceRupees: p.priceRupees,
        isActive: p.isActive,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
    };
  }

  @Post('segments')
  @Roles(Role.ADMIN, Role.OPS)
  async createSegmentCategory(@Body() dto: CreateSegmentCategoryDto, @CurrentUser() user: AuthUser) {
    const segment = await this.adminCatalogService.createSegmentCategory(
      dto.code,
      dto.label,
      dto.isActive,
      user,
      dto.branchId,
    );
    return {
      id: segment.id,
      branchId: segment.branchId,
      code: segment.code,
      label: segment.label,
      isActive: segment.isActive,
      createdAt: segment.createdAt,
    };
  }

  @Post('service-categories')
  @Roles(Role.ADMIN, Role.OPS)
  async createServiceCategory(@Body() dto: CreateServiceCategoryDto, @CurrentUser() user: AuthUser) {
    const category = await this.adminCatalogService.createServiceCategory(
      dto.code,
      dto.label,
      dto.isActive,
      user,
      dto.branchId,
    );
    return {
      id: category.id,
      branchId: category.branchId,
      code: category.code,
      label: category.label,
      isActive: category.isActive,
      createdAt: category.createdAt,
    };
  }

  @Patch('service-categories/:id')
  @Roles(Role.ADMIN, Role.OPS)
  async updateServiceCategory(
    @Param('id') id: string,
    @Body() dto: PatchServiceCategoryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const category = await this.adminCatalogService.updateServiceCategory(
      id,
      {
        label: dto.label,
        isActive: dto.isActive,
      },
      user,
    );
    return {
      id: category.id,
      branchId: category.branchId,
      code: category.code,
      label: category.label,
      isActive: category.isActive,
      createdAt: category.createdAt,
    };
  }

  @Delete('service-categories/:id')
  @Roles(Role.ADMIN, Role.OPS)
  async deleteServiceCategory(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.adminCatalogService.deleteServiceCategory(id, user);
    return { success: true };
  }

  @Patch('segments/:id')
  @Roles(Role.ADMIN, Role.OPS)
  async updateSegmentCategory(
    @Param('id') id: string,
    @Body() dto: PatchSegmentCategoryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const segment = await this.adminCatalogService.updateSegmentCategory(
      id,
      {
        label: dto.label,
        isActive: dto.isActive,
      },
      user,
    );
    return {
      id: segment.id,
      branchId: segment.branchId,
      code: segment.code,
      label: segment.label,
      isActive: segment.isActive,
      createdAt: segment.createdAt,
    };
  }

  @Delete('segments/:id')
  @Roles(Role.ADMIN, Role.OPS)
  async deleteSegmentCategory(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.adminCatalogService.deleteSegmentCategory(id, user);
    return { success: true };
  }

  @Post('icon/upload')
  @Roles(Role.ADMIN, Role.OPS)
  @UseInterceptors(FileInterceptor('file', catalogIconMulterOptions()))
  async uploadCatalogIcon(@UploadedFile() file: MulterUploadFile, @Req() req: Request) {
    if (!file?.filename) {
      throw new BadRequestException('File is required');
    }
    const iconKey = sanitizeIconKey(String((req.query?.key as string | undefined) ?? (req.query?.itemId as string | undefined) ?? 'default'));
    return this.adminCatalogService.uploadCatalogIcon(file.filename, iconKey);
  }

  @Post('import')
  @Roles(Role.ADMIN, Role.OPS)
  async importCatalog(@Body() dto: ImportCatalogDto, @CurrentUser() user: AuthUser) {
    return this.adminCatalogService.importCatalog(dto.content, user, dto.branchId);
  }

  @Get('import/sample')
  async getImportSample() {
    const csv = this.adminCatalogService.getImportSampleCsv();
    return { content: csv };
  }
}