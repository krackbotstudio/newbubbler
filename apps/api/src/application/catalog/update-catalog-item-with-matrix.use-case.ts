import { AppError } from '../errors';
import { ServiceType } from '@shared/enums';
import type {
  LaundryItemsRepo,
  LaundryItemRecord,
  LaundryItemPricesRepo,
  ServiceCategoryRepo,
  SegmentCategoryRepo,
  ItemSegmentServicePriceRepo,
  ItemSegmentServicePriceRecord,
} from '../ports';

const LEGACY_SERVICE_TYPES = new Set<string>(Object.values(ServiceType));

export interface SegmentPriceInput {
  segmentCategoryId: string;
  serviceCategoryId: string;
  priceRupees: number;
  isActive: boolean;
}

export interface UpdateCatalogItemWithMatrixInput {
  itemId: string;
  name?: string;
  active?: boolean;
  icon?: string | null;
  segmentPrices: SegmentPriceInput[];
  /** Used to pick the correct MEN segment row when syncing legacy LaundryItemPrice. */
  itemBranchIds?: string[];
}

export interface UpdateCatalogItemWithMatrixDeps {
  laundryItemsRepo: LaundryItemsRepo;
  laundryItemPricesRepo: LaundryItemPricesRepo;
  serviceCategoryRepo: ServiceCategoryRepo;
  segmentCategoryRepo: SegmentCategoryRepo;
  itemSegmentServicePriceRepo: ItemSegmentServicePriceRepo;
}

export async function updateCatalogItemWithMatrix(
  input: UpdateCatalogItemWithMatrixInput,
  deps: UpdateCatalogItemWithMatrixDeps,
): Promise<{ item: LaundryItemRecord; segmentPrices: ItemSegmentServicePriceRecord[] }> {
  const item = await deps.laundryItemsRepo.getById(input.itemId);
  if (!item) {
    throw new AppError('ITEM_NOT_FOUND', 'Laundry item not found', { itemId: input.itemId });
  }

  const patch: { name?: string; active?: boolean; icon?: string | null } = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.active !== undefined) patch.active = input.active;
  if (input.icon !== undefined) patch.icon = input.icon;

  if (Object.keys(patch).length > 0) {
    await deps.laundryItemsRepo.update(input.itemId, patch);
  }

  const matrixRows = input.segmentPrices.map((r) => ({
    segmentCategoryId: r.segmentCategoryId,
    serviceCategoryId: r.serviceCategoryId,
    priceRupees: Math.max(0, Math.floor(Number(r.priceRupees))),
    isActive: Boolean(r.isActive),
  }));

  const segmentPrices = await deps.itemSegmentServicePriceRepo.replaceForItem(input.itemId, matrixRows);

  // Backward compat: sync segment with code 'MEN' to LaundryItemPrice for existing ServiceType enum
  const menSegment = await deps.segmentCategoryRepo.findFirstByCodeInBranches(
    'MEN',
    input.itemBranchIds ?? [],
  );
  if (menSegment) {
    const menRows = matrixRows.filter((r) => r.segmentCategoryId === menSegment.id);
    for (const row of menRows) {
      const category = await deps.serviceCategoryRepo.getById(row.serviceCategoryId);
      if (!category || !LEGACY_SERVICE_TYPES.has(category.code)) continue;
      await deps.laundryItemPricesRepo.upsertPrice(
        input.itemId,
        category.code as ServiceType,
        row.priceRupees * 100,
        row.isActive,
      );
    }
  }

  const updatedItem = await deps.laundryItemsRepo.getById(input.itemId);
  return {
    item: updatedItem!,
    segmentPrices,
  };
}
