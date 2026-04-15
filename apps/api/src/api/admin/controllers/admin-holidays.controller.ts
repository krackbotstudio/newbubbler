import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { Role } from '@shared/enums';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import type { AuthUser } from '../../common/roles.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { AdminHolidaysService } from '../services/admin-holidays.service';
import { AddHolidayDto } from '../dto/add-holiday.dto';
import { PatchHolidayDto } from '../dto/patch-holiday.dto';

@Controller('admin/holidays')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OPS)
export class AdminHolidaysController {
  constructor(private readonly adminHolidaysService: AdminHolidaysService) {}

  @Get()
  async list(
    @Query('from') fromStr: string,
    @Query('to') toStr: string,
    @Query('branchId') branchId: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    const effectiveBranchId = user.role === Role.OPS && user.branchId ? user.branchId : branchId ?? null;
    const from = fromStr ? new Date(fromStr) : new Date();
    const to = toStr ? new Date(toStr) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    return this.adminHolidaysService.list(from, to, effectiveBranchId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.OPS)
  async add(@Body() dto: AddHolidayDto, @CurrentUser() user: AuthUser) {
    const date = new Date(dto.date);
    return this.adminHolidaysService.addForActor(user, date, dto.label, dto.branchId ?? null);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OPS)
  async update(@Param('id') id: string, @Body() dto: PatchHolidayDto, @CurrentUser() user: AuthUser) {
    const patch: { date?: Date; label?: string | null; branchId?: string | null } = {};
    if (dto.date !== undefined) patch.date = new Date(dto.date);
    if (dto.label !== undefined) patch.label = dto.label;
    if (dto.branchId !== undefined) patch.branchId = dto.branchId ?? null;
    return this.adminHolidaysService.updateForActor(user, id, patch);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.OPS)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.adminHolidaysService.removeForActor(user, id);
    return { ok: true };
  }
}
