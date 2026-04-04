import { BadRequestException, Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { Role } from '@shared/enums';
import { AGENT_ROLE } from '../../common/agent-role';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { AdminSubscriptionPlansService } from '../services/admin-subscription-plans.service';
import type { UpdateSubscriptionPlanPatch } from '../../../application/ports';
import { CreateSubscriptionPlanDto } from '../dto/create-subscription-plan.dto';
import { PatchSubscriptionPlanDto } from '../dto/patch-subscription-plan.dto';

function hasValue(v: number | null | undefined): boolean {
  return v != null && Number(v) > 0;
}

/** Ensure at most one of kgLimit or itemsLimit is set; return normalized values. */
function normalizeLimits(kgLimit: number | null | undefined, itemsLimit: number | null | undefined): { kgLimit: number | null; itemsLimit: number | null } {
  const hasKg = hasValue(kgLimit);
  const hasItems = hasValue(itemsLimit);
  if (hasKg && hasItems) {
    throw new BadRequestException('Only one of kg limit or items limit can be set for a plan.');
  }
  return {
    kgLimit: hasKg ? Number(kgLimit) : null,
    itemsLimit: hasItems ? Number(itemsLimit) : null,
  };
}

@Controller('admin/subscription-plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OPS, AGENT_ROLE)
export class AdminSubscriptionPlansController {
  constructor(private readonly adminSubscriptionPlansService: AdminSubscriptionPlansService) {}

  @Get()
  @Roles(Role.ADMIN, Role.OPS, AGENT_ROLE)
  async list() {
    return this.adminSubscriptionPlansService.list();
  }

  @Post()
  @Roles(Role.ADMIN, Role.OPS)
  async create(@Body() dto: CreateSubscriptionPlanDto) {
    const { kgLimit, itemsLimit } = normalizeLimits(dto.kgLimit, dto.itemsLimit);
    const plan = await this.adminSubscriptionPlansService.create({
      name: dto.name,
      description: dto.description,
      redemptionMode: dto.redemptionMode,
      variant: dto.variant,
      validityDays: dto.validityDays,
      maxPickups: dto.maxPickups,
      kgLimit,
      itemsLimit,
      pricePaise: dto.pricePaise,
      active: dto.active,
      applicableServiceTypes: dto.applicableServiceTypes,
      branchIds: dto.branchIds ?? [],
    });
    return plan;
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OPS)
  async update(@Param('id') id: string, @Body() dto: PatchSubscriptionPlanDto) {
    const limitsInBody = dto.kgLimit !== undefined || dto.itemsLimit !== undefined;
    let kgLimit: number | null | undefined = dto.kgLimit;
    let itemsLimit: number | null | undefined = dto.itemsLimit;
    if (limitsInBody) {
      const normalized = normalizeLimits(dto.kgLimit, dto.itemsLimit);
      kgLimit = normalized.kgLimit;
      itemsLimit = normalized.itemsLimit;
    }
    const patch: UpdateSubscriptionPlanPatch = {
      name: dto.name,
      description: dto.description,
      redemptionMode: dto.redemptionMode,
      variant: dto.variant,
      validityDays: dto.validityDays,
      maxPickups: dto.maxPickups,
      ...(limitsInBody && { kgLimit, itemsLimit }),
      pricePaise: dto.pricePaise,
      active: dto.active,
      applicableServiceTypes: dto.applicableServiceTypes,
      branchIds: dto.branchIds,
    };
    return this.adminSubscriptionPlansService.update(id, patch);
  }
}
