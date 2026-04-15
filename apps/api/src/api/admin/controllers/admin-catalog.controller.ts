import { Controller, Get, Post, Patch, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { Role } from '@shared/enums';
import { AGENT_ROLE } from '../../common/agent-role';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthUser } from '../../common/roles.guard';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { AdminCatalogService } from '../services/admin-catalog.service';
import { CreateItemDto } from '../dto/create-item.dto';
import { PatchItemDto } from '../dto/patch-item.dto';
import { PutItemPricesDto } from '../dto/put-item-prices.dto';

@Controller('admin/items')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OPS, AGENT_ROLE)
export class AdminCatalogController {
  constructor(private readonly adminCatalogService: AdminCatalogService) {}

  @Get()
  async list(@Query('withPrices') withPrices?: string) {
    return this.adminCatalogService.listItems(withPrices === 'true' || withPrices === '1');
  }

  @Post()
  @Roles(Role.ADMIN, Role.OPS)
  async create(@Body() dto: CreateItemDto, @CurrentUser() user: AuthUser) {
    const item = await this.adminCatalogService.createItem(
      dto.name,
      dto.active ?? true,
      dto.icon ?? null,
    );
    if (user?.role === Role.OPS && user.branchId) {
      await this.adminCatalogService.assignItemToBranches(item.id, [user.branchId]);
    }
    return { id: item.id, name: item.name, active: item.active, icon: item.icon ?? null };
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OPS)
  async update(@Param('id') id: string, @Body() dto: PatchItemDto, @CurrentUser() user: AuthUser) {
    const item = await this.adminCatalogService.updateItem(
      id,
      {
        name: dto.name,
        active: dto.active,
        icon: dto.icon ?? null,
      },
      user,
    );
    return { id: item.id, name: item.name, active: item.active, icon: item.icon ?? null };
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.OPS)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.adminCatalogService.deleteItem(id, user);
    return { ok: true };
  }

  @Put(':id/prices')
  @Roles(Role.ADMIN, Role.OPS)
  async putPrices(@Param('id') id: string, @Body() dto: PutItemPricesDto, @CurrentUser() user: AuthUser) {
    const prices = await this.adminCatalogService.upsertItemPrices(
      id,
      dto.prices.map((p) => ({
        serviceType: p.serviceType,
        unitPricePaise: p.unitPricePaise,
        active: p.active,
      })),
      user,
    );
    return prices.map((p) => ({
      id: p.id,
      itemId: p.itemId,
      serviceType: p.serviceType,
      unitPricePaise: p.unitPricePaise,
      active: p.active,
    }));
  }
}
