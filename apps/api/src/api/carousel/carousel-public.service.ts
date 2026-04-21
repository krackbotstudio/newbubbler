import { Inject, Injectable } from '@nestjs/common';
import type { CarouselRepo, CustomerPortalsRepo } from '../../application/ports';
import { CAROUSEL_REPO, CUSTOMER_PORTALS_REPO } from '../../infra/infra.module';

@Injectable()
export class CarouselPublicService {
  constructor(
    @Inject(CAROUSEL_REPO) private readonly carouselRepo: CarouselRepo,
    @Inject(CUSTOMER_PORTALS_REPO) private readonly customerPortalsRepo: CustomerPortalsRepo,
  ) {}

  /** Global carousel (Branding page). */
  private async getGlobalCarouselUrls(): Promise<string[]> {
    const images = await this.carouselRepo.list();
    const ordered = [null, null, null] as (string | null)[];
    for (const img of images) {
      if (img.position >= 1 && img.position <= 3) {
        ordered[img.position - 1] = img.imageUrl;
      }
    }
    return ordered.filter((u): u is string => u != null);
  }

  /**
   * Public home carousel. When `branchId` is set, prefers that branch's customer-portal
   * carousel (admin: Customer portal → carousel slots). Falls back to global carousel.
   */
  async getPublic(branchId?: string | null): Promise<{ imageUrls: string[] }> {
    const id = branchId?.trim();
    if (id) {
      const portal = await this.customerPortalsRepo.getByBranchId(id);
      if (portal?.isActive && portal.carouselImages?.length) {
        const slots = [null, null, null] as (string | null)[];
        for (const img of portal.carouselImages) {
          if (img.position >= 1 && img.position <= 3 && img.imageUrl?.trim()) {
            slots[img.position - 1] = img.imageUrl.trim();
          }
        }
        const fromPortal = slots.filter((u): u is string => u != null);
        if (fromPortal.length > 0) {
          return { imageUrls: fromPortal };
        }
      }
    }
    const imageUrls = await this.getGlobalCarouselUrls();
    return { imageUrls };
  }
}
