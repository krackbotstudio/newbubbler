import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@shared/enums';
import type { AuthUser } from '../../common/roles.guard';
import type { HolidaysRepo, HolidayRecord, UpdateHolidayPatch } from '../../../application/ports';
import { HOLIDAYS_REPO } from '../../../infra/infra.module';

@Injectable()
export class AdminHolidaysService {
  constructor(
    @Inject(HOLIDAYS_REPO)
    private readonly holidaysRepo: HolidaysRepo,
  ) {}

  async list(from: Date, to: Date, branchId?: string | null) {
    return this.holidaysRepo.list(from, to, branchId ?? undefined);
  }

  private assertOpsCanWriteBranchHoliday(holiday: HolidayRecord, actor: AuthUser): void {
    if (actor.role !== Role.OPS) return;
    if (!actor.branchId) {
      throw new ForbiddenException('Branch head is not assigned to a branch.');
    }
    if (holiday.branchId == null) {
      throw new ForbiddenException('Branch heads cannot change org-wide holidays.');
    }
    if (holiday.branchId !== actor.branchId) {
      throw new ForbiddenException('You can only manage holidays for your branch.');
    }
  }

  async addForActor(actor: AuthUser, date: Date, label?: string | null, branchId?: string | null) {
    if (actor.role === Role.OPS) {
      if (!actor.branchId) {
        throw new ForbiddenException('Branch head is not assigned to a branch.');
      }
      if (branchId == null || branchId !== actor.branchId) {
        throw new ForbiddenException('Branch heads can only add holidays for their own branch.');
      }
    }
    return this.holidaysRepo.add(date, label, branchId ?? undefined);
  }

  async updateForActor(actor: AuthUser, id: string, patch: UpdateHolidayPatch) {
    const existing = await this.holidaysRepo.getById(id);
    if (!existing) {
      throw new NotFoundException('Holiday not found');
    }
    if (actor.role === Role.OPS) {
      this.assertOpsCanWriteBranchHoliday(existing, actor);
      if (patch.branchId !== undefined) {
        if (patch.branchId == null) {
          throw new ForbiddenException('Branch heads cannot set org-wide holidays.');
        }
        if (patch.branchId !== actor.branchId) {
          throw new ForbiddenException('You can only assign holidays to your branch.');
        }
      }
    }
    return this.holidaysRepo.update(id, patch);
  }

  async removeForActor(actor: AuthUser, id: string) {
    const existing = await this.holidaysRepo.getById(id);
    if (!existing) {
      throw new NotFoundException('Holiday not found');
    }
    if (actor.role === Role.OPS) {
      this.assertOpsCanWriteBranchHoliday(existing, actor);
    }
    return this.holidaysRepo.remove(id);
  }
}
