import { Inject, Injectable } from '@nestjs/common';
import type { BranchRepo, CustomerPortalsRepo } from '../../application/ports';
import { BRANCH_REPO, CUSTOMER_PORTALS_REPO } from '../../infra/infra.module';
import { AppError } from '../../application/errors';
import { extractHost, portalSlugFromHost } from '../common/portal-host.util';

@Injectable()
export class PortalPublicService {
  constructor(
    @Inject(CUSTOMER_PORTALS_REPO)
    private readonly portalsRepo: CustomerPortalsRepo,
    @Inject(BRANCH_REPO)
    private readonly branchRepo: BranchRepo,
  ) {}

  private async resolveByHost(rawHost: string | undefined, slugHint?: string) {
    const hinted = (slugHint ?? '').trim().toLowerCase();
    const host = extractHost(rawHost);
    const slug = hinted || portalSlugFromHost(host);
    if (!slug) throw new AppError('NOT_FOUND', 'Portal host not found');
    const portal = await this.portalsRepo.getByAccessKey(slug);
    if (!portal || !portal.isActive) throw new AppError('NOT_FOUND', 'Portal not found');
    return portal;
  }

  async getPublicByHost(rawHost: string | undefined, slugHint?: string) {
    const portal = await this.resolveByHost(rawHost, slugHint);
    const branch = await this.branchRepo.getById(portal.branchId);
    return {
      id: portal.id,
      branchId: portal.branchId,
      slug: portal.slug,
      brandName: portal.brandName,
      // Customer portal logo should follow branch branding by default.
      logoUrl: branch?.logoUrl ?? portal.logoUrl,
      appIconUrl: portal.appIconUrl,
      primaryColor: branch?.primaryColor ?? null,
      secondaryColor: branch?.secondaryColor ?? null,
      termsAndConditions: portal.termsAndConditions,
      carouselImages: portal.carouselImages,
    };
  }

  async joinFromHost(rawHost: string | undefined, customerUserId: string, slugHint?: string) {
    const portal = await this.resolveByHost(rawHost, slugHint);
    await this.portalsRepo.addMember(portal.id, customerUserId);
    return { portalId: portal.id, joined: true };
  }

  async membershipFromHost(rawHost: string | undefined, customerUserId: string, slugHint?: string) {
    const portal = await this.resolveByHost(rawHost, slugHint);
    const member = await this.portalsRepo.isMember(portal.id, customerUserId);
    return {
      portalId: portal.id,
      portalSlug: portal.slug,
      portalBrandName: portal.brandName,
      isMember: member,
      branchId: portal.branchId,
    };
  }

  async resolvePortalForHost(rawHost: string | undefined, slugHint?: string) {
    return this.resolveByHost(rawHost, slugHint);
  }
}

