import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '@shared/enums';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { ItemsService } from './items.service';
import { ListItemsQueryDto } from './dto/list-items-query.dto';

@Controller('items')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER)
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  async list(@Query() query: ListItemsQueryDto) {
    const items = await this.itemsService.listForService(query.serviceType);
    return items.map((i) => ({
      itemId: i.itemId,
      name: i.name,
      unitPricePaise: i.unitPricePaise,
      serviceType: i.serviceType,
    }));
  }

  @Get('price-list')
  async listPriceList() {
    return this.itemsService.listPriceList();
  }
}
