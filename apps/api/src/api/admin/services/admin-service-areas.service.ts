import { Inject, Injectable } from '@nestjs/common';
import { listServiceAreas } from '../../../application/service-areas/list-service-areas.use-case';
import { upsertServiceArea } from '../../../application/service-areas/upsert-service-area.use-case';
import type { ServiceAreaRepo, UpdateServiceAreaPatch } from '../../../application/ports';
import { SERVICE_AREA_REPO } from '../../../infra/infra.module';

@Injectable()
export class AdminServiceAreasService {
  constructor(
    @Inject(SERVICE_AREA_REPO)
    private readonly serviceAreaRepo: ServiceAreaRepo,
  ) {}

  async list(branchId?: string) {
    return listServiceAreas({ serviceAreaRepo: this.serviceAreaRepo }, branchId);
  }

  async upsert(pincode: string, branchId: string, active: boolean) {
    return upsertServiceArea(pincode, branchId, active, {
      serviceAreaRepo: this.serviceAreaRepo,
    });
  }

  async getById(id: string) {
    return this.serviceAreaRepo.getById(id);
  }

  async update(id: string, patch: UpdateServiceAreaPatch) {
    return this.serviceAreaRepo.update(id, patch);
  }

  async remove(id: string) {
    return this.serviceAreaRepo.remove(id);
  }
}
