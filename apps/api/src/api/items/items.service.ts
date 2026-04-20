import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../application/errors';
import { listCatalogForService } from '../../application/catalog/list-catalog-for-service.use-case';
import { listCatalogItemsWithMatrix } from '../../application/catalog/list-catalog-items-with-matrix.use-case';
import type { ServiceType } from '@shared/enums';
import type {
  CustomerPortalsRepo,
  LaundryItemsRepo,
  LaundryItemPricesRepo,
  ServiceCategoryRepo,
  SegmentCategoryRepo,
  ItemSegmentServicePriceRepo,
} from '../../application/ports';
import {
  CUSTOMER_PORTALS_REPO,
  LAUNDRY_ITEMS_REPO,
  LAUNDRY_ITEM_PRICES_REPO,
  SERVICE_CATEGORY_REPO,
  SEGMENT_CATEGORY_REPO,
  ITEM_SEGMENT_SERVICE_PRICE_REPO,
} from '../../infra/infra.module';
import { extractHost, portalSlugFromHost } from '../common/portal-host.util';

@Injectable()
export class ItemsService {
  constructor(
    @Inject(LAUNDRY_ITEMS_REPO) private readonly laundryItemsRepo: LaundryItemsRepo,
    @Inject(LAUNDRY_ITEM_PRICES_REPO) private readonly laundryItemPricesRepo: LaundryItemPricesRepo,
    @Inject(SERVICE_CATEGORY_REPO) private readonly serviceCategoryRepo: ServiceCategoryRepo,
    @Inject(SEGMENT_CATEGORY_REPO) private readonly segmentCategoryRepo: SegmentCategoryRepo,
    @Inject(ITEM_SEGMENT_SERVICE_PRICE_REPO) private readonly itemSegmentServicePriceRepo: ItemSegmentServicePriceRepo,
    @Inject(CUSTOMER_PORTALS_REPO) private readonly customerPortalsRepo: CustomerPortalsRepo,
  ) {}

  async listForService(serviceType: ServiceType) {
    return listCatalogForService(serviceType, {
      laundryItemsRepo: this.laundryItemsRepo,
      laundryItemPricesRepo: this.laundryItemPricesRepo,
    });
  }

  private async resolvePortalBranchId(rawHost?: string, slugHint?: string): Promise<string | null> {
    const hinted = (slugHint ?? '').trim().toLowerCase();
    const host = extractHost(rawHost);
    const fromHost = portalSlugFromHost(host) ?? '';
    const slug = hinted || fromHost;
    if (!slug) return null;
    const portal = await this.customerPortalsRepo.getByAccessKey(slug);
    if (!portal || !portal.isActive) throw new AppError('NOT_FOUND', 'Portal not found');
    return portal.branchId;
  }

  async listPriceList(rawHost?: string, slugHint?: string) {
    const branchId = await this.resolvePortalBranchId(rawHost, slugHint);
    const result = await listCatalogItemsWithMatrix({
      laundryItemsRepo: this.laundryItemsRepo,
      serviceCategoryRepo: this.serviceCategoryRepo,
      segmentCategoryRepo: this.segmentCategoryRepo,
      itemSegmentServicePriceRepo: this.itemSegmentServicePriceRepo,
    }, branchId ? { categoryBranchId: branchId } : undefined);

    const activeSegmentLabelById = new Map(
      result.segmentCategories
        .filter((s) => s.isActive)
        .map((s) => [s.id, s.label]),
    );
    const activeServiceLabelById = new Map(
      result.serviceCategories
        .filter((s) => s.isActive)
        .map((s) => [s.id, s.label]),
    );

    return result.items
      .filter((item) => item.active)
      .map((item) => {
        const lineMap = new Map<string, { segment: string; service: string; priceRupees: number }>();
        for (const row of item.segmentPrices) {
          if (!row.isActive) continue;
          const segment = activeSegmentLabelById.get(row.segmentCategoryId);
          const service = activeServiceLabelById.get(row.serviceCategoryId);
          if (!segment || !service) continue;
          const key = `${row.segmentCategoryId}-${row.serviceCategoryId}`;
          if (!lineMap.has(key)) {
            lineMap.set(key, { segment, service, priceRupees: row.priceRupees });
          }
        }
        const lines = Array.from(lineMap.values()).sort((a, b) => {
          if (a.segment !== b.segment) return a.segment.localeCompare(b.segment);
          return a.service.localeCompare(b.service);
        });
        return {
          itemId: item.id,
          name: item.name,
          icon: item.icon ?? null,
          lines,
        };
      })
      .filter((item) => item.lines.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
