import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { Role } from '@shared/enums';
import type { AuthUser } from '../../common/roles.guard';
import { AGENT_ROLE } from '../../common/agent-role';
import { listItemsAdmin } from '../../../application/catalog/list-items.use-case';
import { createLaundryItem } from '../../../application/catalog/create-laundry-item.use-case';
import { updateLaundryItem } from '../../../application/catalog/update-laundry-item.use-case';
import { upsertItemPrices } from '../../../application/catalog/upsert-item-prices.use-case';
import { listCatalogItemsWithMatrix } from '../../../application/catalog/list-catalog-items-with-matrix.use-case';
import { updateCatalogItemWithMatrix } from '../../../application/catalog/update-catalog-item-with-matrix.use-case';
import { createServiceCategory } from '../../../application/catalog/create-service-category.use-case';
import { createSegmentCategory } from '../../../application/catalog/create-segment-category.use-case';
import { importCatalogFromFile } from '../../../application/catalog/import-catalog-from-file.use-case';
import type { ServiceType } from '@shared/enums';
import type {
  BranchRepo,
  LaundryItemBranchRepo,
  LaundryItemsRepo,
  LaundryItemPricesRepo,
  ServiceCategoryRepo,
  SegmentCategoryRepo,
  ItemSegmentServicePriceRepo,
  StorageAdapter,
} from '../../../application/ports';
import {
  BRANCH_REPO,
  LAUNDRY_ITEM_BRANCH_REPO,
  LAUNDRY_ITEMS_REPO,
  LAUNDRY_ITEM_PRICES_REPO,
  SERVICE_CATEGORY_REPO,
  SEGMENT_CATEGORY_REPO,
  ITEM_SEGMENT_SERVICE_PRICE_REPO,
  STORAGE_ADAPTER,
} from '../../../infra/infra.module';

@Injectable()
export class AdminCatalogService {
  constructor(
    @Inject(LAUNDRY_ITEMS_REPO) private readonly laundryItemsRepo: LaundryItemsRepo,
    @Inject(LAUNDRY_ITEM_BRANCH_REPO) private readonly laundryItemBranchRepo: LaundryItemBranchRepo,
    @Inject(LAUNDRY_ITEM_PRICES_REPO) private readonly laundryItemPricesRepo: LaundryItemPricesRepo,
    @Inject(SERVICE_CATEGORY_REPO) private readonly serviceCategoryRepo: ServiceCategoryRepo,
    @Inject(SEGMENT_CATEGORY_REPO) private readonly segmentCategoryRepo: SegmentCategoryRepo,
    @Inject(ITEM_SEGMENT_SERVICE_PRICE_REPO) private readonly itemSegmentServicePriceRepo: ItemSegmentServicePriceRepo,
    @Inject(BRANCH_REPO) private readonly branchRepo: BranchRepo,
    @Inject(STORAGE_ADAPTER) private readonly storageAdapter: StorageAdapter,
  ) {}
  private extFromName(name: string | undefined): string {
    const ext = path.extname(name || 'file').toLowerCase();
    if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') return ext;
    return '.png';
  }


  /** Default (main) branch id — taxonomy rows on this branch are treated as org-wide “common”. */
  private async resolveDefaultBranchId(): Promise<string | undefined> {
    const branches = await this.branchRepo.listAll();
    if (branches.length === 0) return undefined;
    return branches.find((b) => b.isDefault)?.id ?? branches[0]?.id;
  }

  /** Branch heads may only change items explicitly linked to their branch (not org-wide “all branches”). */
  async assertBranchHeadCanMutateCatalogItem(actor: AuthUser | undefined, itemId: string): Promise<void> {
    if (!actor || actor.role !== Role.OPS) return;
    if (!actor.branchId) {
      throw new ForbiddenException('Branch head is not assigned to a branch.');
    }
    const ids = await this.laundryItemBranchRepo.getBranchIdsForItem(itemId);
    if (ids.length === 0) {
      throw new ForbiddenException(
        'Branch heads cannot change items that apply to all branches. Ask an admin or assign this item to your branch first.',
      );
    }
    if (!ids.includes(actor.branchId)) {
      throw new ForbiddenException('This item is not assigned to your branch.');
    }
  }

  /**
   * Branch heads only control whether their branch is linked; other branches are preserved.
   * Prevents widening to “all branches” (empty junction) by mistake.
   */
  private async mergeBranchIdsForOpsMatrixPut(
    actor: AuthUser & { branchId: string },
    itemId: string,
    requested: string[] | undefined,
  ): Promise<string[]> {
    const current = await this.laundryItemBranchRepo.getBranchIdsForItem(itemId);
    const others = current.filter((b) => b !== actor.branchId);
    const req = requested ?? current;
    const wantsOwn = req.includes(actor.branchId);
    const merged = [...others, ...(wantsOwn ? [actor.branchId] : [])];
    const unique = [...new Set(merged)];
    if (unique.length === 0) {
      throw new ForbiddenException(
        'Branch heads cannot leave an item available at all branches. Use an admin account or keep your branch selected.',
      );
    }
    return unique;
  }

  /** When set, catalog matrix lists only that branch’s segment/service definitions. */
  private resolveCategoryBranchScope(actor: AuthUser | undefined, queryBranchId?: string): string | undefined {
    if (actor?.branchId && (actor.role === Role.OPS || actor.role === AGENT_ROLE)) {
      return actor.branchId;
    }
    if (actor?.role === Role.ADMIN && queryBranchId?.trim()) {
      return queryBranchId.trim();
    }
    return undefined;
  }

  private resolveTaxonomyBranchIdForMutation(actor: AuthUser, branchIdFromClient?: string): string {
    if (actor.role === Role.OPS) {
      if (!actor.branchId) {
        throw new ForbiddenException('Branch head is not assigned to a branch.');
      }
      if (branchIdFromClient && branchIdFromClient !== actor.branchId) {
        throw new ForbiddenException('You can only manage segments and services for your branch.');
      }
      return actor.branchId;
    }
    if (actor.role === Role.ADMIN) {
      const b = branchIdFromClient?.trim();
      if (!b) {
        throw new BadRequestException('branchId is required');
      }
      return b;
    }
    throw new ForbiddenException('Only admins and branch heads can manage catalog taxonomy.');
  }

  private async assertOpsOwnsCategoryBranch(branchId: string, actor?: AuthUser): Promise<void> {
    if (!actor || actor.role !== Role.OPS) return;
    if (!actor.branchId || branchId !== actor.branchId) {
      throw new ForbiddenException('You can only manage segments and services for your branch.');
    }
  }

  async listItems(withPrices = false) {
    const items = await listItemsAdmin({ laundryItemsRepo: this.laundryItemsRepo });
    if (!withPrices) return items;
    const withPricesList = await Promise.all(
      items.map(async (item) => {
        const prices = await this.laundryItemPricesRepo.listForItem(item.id);
        return {
          ...item,
          prices: prices.map((p) => ({
            id: p.id,
            itemId: p.itemId,
            serviceType: p.serviceType,
            unitPricePaise: p.unitPricePaise,
            active: p.active,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          })),
        };
      }),
    );
    return withPricesList;
  }

  async createItem(name: string, active: boolean, icon: string | null | undefined) {
    return createLaundryItem(name, active, icon, {
      laundryItemsRepo: this.laundryItemsRepo,
    });
  }

  async assignItemToBranches(itemId: string, branchIds: string[]): Promise<void> {
    await this.laundryItemBranchRepo.setBranchesForItem(itemId, branchIds);
  }

  async updateItem(
    id: string,
    patch: { name?: string; active?: boolean; icon?: string | null },
    actor?: AuthUser,
  ) {
    await this.assertBranchHeadCanMutateCatalogItem(actor, id);
    return updateLaundryItem(id, patch, {
      laundryItemsRepo: this.laundryItemsRepo,
    });
  }

  async deleteItem(id: string, actor?: AuthUser): Promise<void> {
    await this.assertBranchHeadCanMutateCatalogItem(actor, id);
    if (actor?.role === Role.OPS && actor.branchId) {
      const ids = await this.laundryItemBranchRepo.getBranchIdsForItem(id);
      if (ids.length !== 1) {
        throw new ForbiddenException(
          'Branch heads can only delete items that are exclusive to their branch. Edit the item to restrict it to this branch only, or ask an admin to remove shared catalog items.',
        );
      }
    }
    const item = await this.laundryItemsRepo.getById(id);
    if (!item) {
      throw new NotFoundException('Catalog item not found');
    }
    await this.laundryItemsRepo.delete(id);
  }

  async upsertItemPrices(
    itemId: string,
    prices: Array<{ serviceType: ServiceType; unitPricePaise: number; active?: boolean }>,
    actor?: AuthUser,
  ) {
    await this.assertBranchHeadCanMutateCatalogItem(actor, itemId);
    return upsertItemPrices(
      { itemId, prices },
      {
        laundryItemsRepo: this.laundryItemsRepo,
        laundryItemPricesRepo: this.laundryItemPricesRepo,
      },
    );
  }

  async listItemsWithMatrix(actor?: AuthUser, queryBranchId?: string) {
    const categoryBranchId = this.resolveCategoryBranchScope(actor, queryBranchId);
    const defaultBranchId = categoryBranchId ? await this.resolveDefaultBranchId() : undefined;
    const sharedTaxonomyBranchId =
      categoryBranchId && defaultBranchId && defaultBranchId !== categoryBranchId
        ? defaultBranchId
        : undefined;
    const result = await listCatalogItemsWithMatrix(
      {
        laundryItemsRepo: this.laundryItemsRepo,
        serviceCategoryRepo: this.serviceCategoryRepo,
        segmentCategoryRepo: this.segmentCategoryRepo,
        itemSegmentServicePriceRepo: this.itemSegmentServicePriceRepo,
      },
      categoryBranchId
        ? { categoryBranchId, ...(sharedTaxonomyBranchId ? { sharedTaxonomyBranchId } : {}) }
        : undefined,
    );
    const itemsWithBranches = await Promise.all(
      result.items.map(async (item) => {
        const branchIds = await this.laundryItemBranchRepo.getBranchIdsForItem(item.id);
        return { ...item, branchIds };
      }),
    );
    return { ...result, items: itemsWithBranches };
  }

  async updateItemWithMatrix(
    itemId: string,
    body: {
      name?: string;
      active?: boolean;
      icon?: string | null;
      segmentPrices: Array<{ segmentCategoryId: string; serviceCategoryId: string; priceRupees: number; isActive?: boolean }>;
      branchIds?: string[];
    },
    actor?: AuthUser,
  ) {
    await this.assertBranchHeadCanMutateCatalogItem(actor, itemId);
    const existingBranchIds = await this.laundryItemBranchRepo.getBranchIdsForItem(itemId);
    let branchIds = body.branchIds !== undefined ? body.branchIds : existingBranchIds;
    if (actor?.role === Role.OPS && actor.branchId) {
      branchIds = await this.mergeBranchIdsForOpsMatrixPut(
        actor as AuthUser & { branchId: string },
        itemId,
        body.branchIds,
      );
    }
    const result = await updateCatalogItemWithMatrix(
      {
        itemId,
        name: body.name,
        active: body.active,
        icon: body.icon,
        itemBranchIds: branchIds,
        segmentPrices: body.segmentPrices.map((p) => ({
          segmentCategoryId: p.segmentCategoryId,
          serviceCategoryId: p.serviceCategoryId,
          priceRupees: p.priceRupees,
          isActive: p.isActive ?? true,
        })),
      },
      {
        laundryItemsRepo: this.laundryItemsRepo,
        laundryItemPricesRepo: this.laundryItemPricesRepo,
        serviceCategoryRepo: this.serviceCategoryRepo,
        segmentCategoryRepo: this.segmentCategoryRepo,
        itemSegmentServicePriceRepo: this.itemSegmentServicePriceRepo,
      },
    );
    await this.laundryItemBranchRepo.setBranchesForItem(itemId, branchIds);
    return result;
  }

  async createServiceCategory(
    code: string,
    label: string,
    isActive: boolean | undefined,
    actor: AuthUser,
    branchIdFromClient?: string,
  ) {
    const branchId = this.resolveTaxonomyBranchIdForMutation(actor, branchIdFromClient);
    return createServiceCategory(
      { branchId, code, label, isActive },
      { serviceCategoryRepo: this.serviceCategoryRepo },
    );
  }

  async createSegmentCategory(
    code: string,
    label: string,
    isActive: boolean | undefined,
    actor: AuthUser,
    branchIdFromClient?: string,
  ) {
    const branchId = this.resolveTaxonomyBranchIdForMutation(actor, branchIdFromClient);
    return createSegmentCategory(
      { branchId, code, label, isActive },
      { segmentCategoryRepo: this.segmentCategoryRepo },
    );
  }

  async updateServiceCategory(id: string, patch: { label?: string; isActive?: boolean }, actor?: AuthUser) {
    const row = await this.serviceCategoryRepo.getById(id);
    if (!row) throw new NotFoundException('Service category not found');
    await this.assertOpsOwnsCategoryBranch(row.branchId, actor);
    return this.serviceCategoryRepo.update(id, patch);
  }

  async deleteServiceCategory(id: string, actor?: AuthUser) {
    const row = await this.serviceCategoryRepo.getById(id);
    if (!row) throw new NotFoundException('Service category not found');
    await this.assertOpsOwnsCategoryBranch(row.branchId, actor);
    return this.serviceCategoryRepo.delete(id);
  }

  async updateSegmentCategory(id: string, patch: { label?: string; isActive?: boolean }, actor?: AuthUser) {
    const row = await this.segmentCategoryRepo.getById(id);
    if (!row) throw new NotFoundException('Segment category not found');
    await this.assertOpsOwnsCategoryBranch(row.branchId, actor);
    return this.segmentCategoryRepo.update(id, patch);
  }

  async deleteSegmentCategory(id: string, actor?: AuthUser) {
    const row = await this.segmentCategoryRepo.getById(id);
    if (!row) throw new NotFoundException('Segment category not found');
    await this.assertOpsOwnsCategoryBranch(row.branchId, actor);
    return this.segmentCategoryRepo.delete(id);
  }

  async importCatalog(csvContent: string, actor: AuthUser, branchIdFromClient?: string) {
    const taxonomyBranchId = this.resolveTaxonomyBranchIdForMutation(actor, branchIdFromClient);
    return importCatalogFromFile(csvContent, {
      laundryItemsRepo: this.laundryItemsRepo,
      serviceCategoryRepo: this.serviceCategoryRepo,
      segmentCategoryRepo: this.segmentCategoryRepo,
      itemSegmentServicePriceRepo: this.itemSegmentServicePriceRepo,
      taxonomyBranchId,
    });
  }

  getImportSampleCsv(): string {
    return 'itemName,segment,serviceCategoryCode,priceRupees,isActive\nShirt,MEN,STEAM_IRON,10,true\nShirt,MEN,DRY_CLEAN,50,true\nJeans,WOMEN,STEAM_IRON,20,true';
  }

  /** Upload a custom icon image (PNG/JPG). Returns the URL to store on the item (icon field). */
  async uploadCatalogIcon(
    file: { buffer: Buffer; originalname?: string; mimetype?: string },
    iconKey?: string,
  ): Promise<{ url: string }> {
    const ext = this.extFromName(file.originalname);
    const keyPart = (iconKey || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'default';
    const fileName = `icon-${keyPart}-${randomUUID()}${ext}`;
    const storagePath = `catalog-icons/${fileName}`;
    const uploaded = await this.storageAdapter.putObject(storagePath, file.buffer, file.mimetype || 'image/png');
    const url =
      typeof uploaded === 'string' && uploaded.length > 0
        ? uploaded
        : `/api/assets/catalog-icons/${fileName}`;
    return { url };
  }

  /** Price lookup for ACK line builder: item + segment + service category. Returns price in rupees or null. */
  async getPriceLookup(
    itemId: string,
    segmentCategoryId: string,
    serviceCategoryId: string,
  ): Promise<{ priceRupees: number } | null> {
    const prices = await this.itemSegmentServicePriceRepo.listByItemId(itemId);
    const match = prices.find(
      (p) =>
        p.segmentCategoryId === segmentCategoryId &&
        p.serviceCategoryId === serviceCategoryId &&
        p.isActive,
    );
    return match ? { priceRupees: match.priceRupees } : null;
  }
}
