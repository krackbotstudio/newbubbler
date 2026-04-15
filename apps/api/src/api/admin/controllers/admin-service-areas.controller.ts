import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
  ForbiddenException,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Role } from '@shared/enums';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import type { AuthUser } from '../../common/roles.guard';
import { AdminServiceAreasService } from '../services/admin-service-areas.service';
import { CreateServiceAreaDto, PatchServiceAreaDto } from '../dto/service-area.dto';

@Controller('admin/service-areas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BILLING, Role.OPS)
export class AdminServiceAreasController {
  constructor(private readonly adminServiceAreasService: AdminServiceAreasService) {}

  @Get()
  async list(@Query('branchId') branchId?: string, @Req() req?: { user: AuthUser }) {
    const user = req?.user as AuthUser | undefined;
    const effectiveBranchId = user?.role === Role.OPS && user?.branchId ? user.branchId : branchId;
    return this.adminServiceAreasService.list(effectiveBranchId);
  }

  @Post()
  async create(@Body() dto: CreateServiceAreaDto, @Req() req: { user: AuthUser }) {
    const user = req.user as AuthUser;
    if (user.role === Role.OPS) {
      if (!user.branchId || dto.branchId !== user.branchId) {
        throw new ForbiddenException('You can only add pincodes for your branch');
      }
    }
    return this.adminServiceAreasService.upsert(dto.pincode, dto.branchId, dto.active);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchServiceAreaDto,
    @Req() req: { user: AuthUser },
  ) {
    const user = req.user as AuthUser;
    const existing = await this.adminServiceAreasService.getById(id);
    if (!existing) {
      throw new NotFoundException('Service area not found');
    }
    if (user.role === Role.OPS) {
      if (dto.branchId !== undefined && dto.branchId !== user.branchId) {
        throw new ForbiddenException('Cannot move pincode to another branch');
      }
      if (existing.branchId !== user.branchId) {
        throw new ForbiddenException('Pincode does not belong to your branch');
      }
    }
    return this.adminServiceAreasService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string, @Req() req: { user: AuthUser }) {
    const user = req.user as AuthUser;
    const existing = await this.adminServiceAreasService.getById(id);
    if (!existing) {
      throw new NotFoundException('Service area not found');
    }
    if (user.role === Role.OPS && existing.branchId !== user.branchId) {
      throw new ForbiddenException('Pincode does not belong to your branch');
    }
    await this.adminServiceAreasService.remove(id);
    return { ok: true };
  }
}
