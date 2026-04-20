import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Role } from '@shared/enums';
import { AGENT_ROLE } from '../../common/agent-role';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard, type AuthUser } from '../../common/roles.guard';
import { AdminBranchesService } from '../services/admin-branches.service';
import { CreateBranchDto } from '../dto/create-branch.dto';
import { UpdateBranchDto } from '../dto/update-branch.dto';

interface MulterUploadFile {
  buffer?: Buffer;
  originalname?: string;
  mimetype?: string;
}

@Controller('admin/branches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminBranchesController {
  constructor(private readonly adminBranchesService: AdminBranchesService) {}

  @Get()
  @Roles(Role.ADMIN, Role.PARTIAL_ADMIN, Role.BILLING, Role.OPS, AGENT_ROLE)
  async list(@Req() req: { user: AuthUser }) {
    return this.adminBranchesService.list(req.user);
  }

  /** Must stay above @Get(':id') so "field-uniqueness" is not parsed as an id. */
  @Get('field-uniqueness')
  @Roles(Role.ADMIN, Role.PARTIAL_ADMIN, Role.BILLING, Role.OPS, AGENT_ROLE)
  async fieldUniqueness(
    @Req() req: { user: AuthUser },
    @Query('excludeBranchId') excludeBranchId?: string,
    @Query('name') name?: string,
    @Query('invoicePrefix') invoicePrefix?: string,
    @Query('itemTagBrandName') itemTagBrandName?: string,
  ) {
    return this.adminBranchesService.checkFieldUniqueness(
      {
        excludeBranchId: excludeBranchId?.trim() || undefined,
        name: name ?? undefined,
        invoicePrefix: invoicePrefix ?? undefined,
        itemTagBrandName: itemTagBrandName ?? undefined,
      },
      req.user,
    );
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.PARTIAL_ADMIN, Role.BILLING, Role.OPS, AGENT_ROLE)
  async getById(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    return this.adminBranchesService.getById(id, req.user);
  }

  @Post()
  @Roles(Role.ADMIN, Role.BILLING)
  async create(@Body() dto: CreateBranchDto, @Req() req: { user: AuthUser }) {
    if (req.user.role !== Role.ADMIN) {
      throw new ForbiddenException('Only admin can create new branches');
    }
    return this.adminBranchesService.create({
      name: dto.name,
      address: dto.address,
      phone: dto.phone ?? null,
      email: dto.email ?? null,
      gstNumber: dto.gstNumber ?? null,
      panNumber: dto.panNumber ?? null,
      footerNote: dto.footerNote ?? null,
      invoicePrefix: dto.invoicePrefix ?? null,
      itemTagBrandName: dto.itemTagBrandName ?? null,
      termsAndConditions: dto.termsAndConditions ?? null,
      primaryColor: dto.primaryColor ?? null,
      secondaryColor: dto.secondaryColor ?? null,
      upiId: dto.upiId ?? null,
      upiPayeeName: dto.upiPayeeName ?? null,
      upiLink: dto.upiLink ?? null,
      isDefault: dto.isDefault,
    });
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.PARTIAL_ADMIN, Role.BILLING, Role.OPS)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
    @Req() req: { user: AuthUser },
  ) {
    return this.adminBranchesService.update(
      id,
      {
        name: dto.name,
        address: dto.address,
        phone: dto.phone,
        email: dto.email,
        gstNumber: dto.gstNumber,
        panNumber: dto.panNumber,
        footerNote: dto.footerNote,
        invoicePrefix: dto.invoicePrefix,
        itemTagBrandName: dto.itemTagBrandName,
        termsAndConditions: dto.termsAndConditions,
        primaryColor: dto.primaryColor,
        secondaryColor: dto.secondaryColor,
        upiId: dto.upiId,
        upiPayeeName: dto.upiPayeeName,
        upiLink: dto.upiLink,
        isDefault: dto.isDefault,
      },
      req.user,
    );
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.BILLING)
  async delete(@Param('id') id: string) {
    await this.adminBranchesService.delete(id);
    return { success: true };
  }

  @Post(':id/logo')
  @Roles(Role.ADMIN, Role.PARTIAL_ADMIN, Role.BILLING, Role.OPS)
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @Param('id') id: string,
    @UploadedFile() file: MulterUploadFile,
    @Req() req: { user: AuthUser },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }
    return this.adminBranchesService.uploadLogo(
      id,
      file as { buffer: Buffer; originalname?: string; mimetype?: string },
      req.user,
    );
  }

  @Post(':id/upi-qr')
  @Roles(Role.ADMIN, Role.PARTIAL_ADMIN, Role.BILLING, Role.OPS)
  @UseInterceptors(FileInterceptor('file'))
  async uploadUpiQr(
    @Param('id') id: string,
    @UploadedFile() file: MulterUploadFile,
    @Req() req: { user: AuthUser },
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }
    return this.adminBranchesService.uploadUpiQr(
      id,
      file as { buffer: Buffer; originalname?: string; mimetype?: string },
      req.user,
    );
  }
}
