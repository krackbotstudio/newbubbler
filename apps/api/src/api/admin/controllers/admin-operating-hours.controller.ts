import {
  BadRequestException,
  Controller,
  Get,
  Put,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { Role } from '@shared/enums';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import type { AuthUser } from '../../common/roles.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import { AdminOperatingHoursService } from '../services/admin-operating-hours.service';
import { SetOperatingHoursDto } from '../dto/set-operating-hours.dto';

@Controller('admin/operating-hours')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OPS)
export class AdminOperatingHoursController {
  constructor(private readonly adminOperatingHoursService: AdminOperatingHoursService) {}

  @Get()
  async get(@Query('branchId') branchId: string | undefined, @CurrentUser() user: AuthUser) {
    const effectiveBranchId = user.role === Role.OPS && user.branchId ? user.branchId : branchId;
    if (!effectiveBranchId || effectiveBranchId.trim() === '') {
      throw new BadRequestException('branchId is required');
    }
    return this.adminOperatingHoursService.get(effectiveBranchId);
  }

  @Put()
  @Roles(Role.ADMIN, Role.OPS)
  async set(@Body() dto: SetOperatingHoursDto, @CurrentUser() user: AuthUser) {
    if (!dto.branchId || dto.branchId.trim() === '') {
      throw new BadRequestException('branchId is required');
    }
    const bid = dto.branchId.trim();
    if (user.role === Role.OPS) {
      if (!user.branchId || user.branchId !== bid) {
        throw new ForbiddenException('You can only set operating hours for your branch.');
      }
    }
    return this.adminOperatingHoursService.set(bid, dto.startTime, dto.endTime);
  }
}
