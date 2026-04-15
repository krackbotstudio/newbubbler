import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Role } from '@shared/enums';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard, type AuthUser } from '../../common/roles.guard';
import { AdminUsersService } from '../services/admin-users.service';
import { CreateAdminUserDto } from '../dto/create-admin-user.dto';
import { UpdateAdminUserDto } from '../dto/update-admin-user.dto';
import { ListAdminUsersQueryDto } from '../dto/list-admin-users-query.dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.OPS)
  async list(@Query() query: ListAdminUsersQueryDto, @Req() req: { user: AuthUser }) {
    const limit = query.limit ? Number(query.limit) : 20;
    const active =
      query.active === 'true' ? true : query.active === 'false' ? false : undefined;

    const user = req.user as AuthUser;
    const branchId =
      user.role === Role.OPS ? (user.branchId ?? undefined) : (query.branchId ?? undefined);

    return this.adminUsersService.list({
      role: query.role,
      active,
      search: query.search,
      branchId,
      limit,
      cursor: query.cursor,
    });
  }

  @Post()
  @Roles(Role.ADMIN, Role.OPS)
  async create(@Body() dto: CreateAdminUserDto, @Req() req: { user: AuthUser }) {
    return this.adminUsersService.create(
      {
        name: dto.name ?? null,
        email: dto.email,
        role: dto.role,
        branchId: dto.branchId ?? null,
        isActive: dto.isActive ?? true,
      },
      req.user,
    );
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  async update(@Param('id') id: string, @Body() dto: UpdateAdminUserDto, @Req() req: any) {
    const currentUser = req.user as AuthUser;
    return this.adminUsersService.update(
      {
        id,
        name: dto.name,
        role: dto.role,
        branchId: dto.branchId,
        isActive: dto.isActive,
      },
      currentUser,
    );
  }

  @Post(':id/reset-password')
  @Roles(Role.ADMIN)
  async resetPassword(@Param('id') id: string) {
    return this.adminUsersService.resetPassword(id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async delete(@Param('id') id: string) {
    await this.adminUsersService.delete(id);
  }
}

