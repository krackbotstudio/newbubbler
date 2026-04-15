import { Inject, Injectable } from '@nestjs/common';
import { checkServiceability } from '../../application/service-areas/check-serviceability.use-case';
import type { ServiceAreaRepo, BranchRepo } from '../../application/ports';
import { SERVICE_AREA_REPO, BRANCH_REPO } from '../../infra/infra.module';

@Injectable()
export class ServiceabilityService {
  constructor(
    @Inject(SERVICE_AREA_REPO)
    private readonly serviceAreaRepo: ServiceAreaRepo,
    @Inject(BRANCH_REPO)
    private readonly branchRepo: BranchRepo,
  ) {}

  async check(pincode: string) {
    return checkServiceability(pincode, { serviceAreaRepo: this.serviceAreaRepo, branchRepo: this.branchRepo });
  }

  /** Branches that actively serve this pincode (for customer branch picker). */
  async listBranchesForPincode(
    pincode: string,
  ): Promise<{ branches: Array<{ id: string; name: string; logoUrl: string | null; updatedAt: string | null }> }> {
    const pc = pincode.trim();
    if (!pc) return { branches: [] };
    const areas = await this.serviceAreaRepo.listActiveByPincode(pc);
    const seen = new Set<string>();
    const branches: Array<{ id: string; name: string; logoUrl: string | null; updatedAt: string | null }> = [];
    for (const a of areas) {
      if (seen.has(a.branchId)) continue;
      seen.add(a.branchId);
      const b = await this.branchRepo.getById(a.branchId);
      branches.push({
        id: a.branchId,
        name: (b?.name ?? '').trim() || a.branchId,
        logoUrl: b?.logoUrl?.trim() ? b.logoUrl.trim() : null,
        updatedAt: b?.updatedAt ? b.updatedAt.toISOString() : null,
      });
    }
    return { branches };
  }
}
