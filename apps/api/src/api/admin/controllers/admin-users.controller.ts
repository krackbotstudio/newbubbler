import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
    /** String checks avoid relying on `Role` enum members matching query strings at runtime. */
    if (user.role === 'OPS') {
      if (!user.branchId) {
        throw new ForbiddenException('Branch head is not assigned to a branch.');
      }
      return this.adminUsersService.list({
        branchHeadList: {
          branchId: user.branchId,
          includeUserId: user.id,
          includeUserEmail: user.email ?? null,
          agentsOnly: query.role === 'AGENT',
          selfAsBranchHeadOnly: query.role === 'OPS',
        },
        active,
        search: query.search,
        limit,
        cursor: query.cursor,
        actorRole: user.role,
      });
    }

    const branchId =
      query.branchId && String(query.branchId).trim() !== '' ? String(query.branchId).trim() : undefined;

    return this.adminUsersService.list({
      role: query.role as Role | undefined,
      active,
      search: query.search,
      branchId,
      limit,
      cursor: query.cursor,
      actorRole: user.role,
    });
  }

  @Post()
  @Roles(Role.ADMIN)
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
  @Roles(Role.ADMIN, Role.OPS)
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
  @Roles(Role.ADMIN, Role.OPS)
  async resetPassword(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    return this.adminUsersService.resetPassword(id, req.user);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.OPS)
  async delete(@Param('id') id: string, @Req() req: { user: AuthUser }) {
    await this.adminUsersService.delete(id, req.user);
  }
}

