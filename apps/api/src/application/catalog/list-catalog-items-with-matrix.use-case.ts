import type {
  LaundryItemsRepo,
  LaundryItemRecord,
  ServiceCategoryRepo,
  ServiceCategoryRecord,
  SegmentCategoryRepo,
  SegmentCategoryRecord,
  ItemSegmentServicePriceRepo,
  ItemSegmentServicePriceRecord,
} from '../ports';

export interface CatalogItemWithMatrix extends LaundryItemRecord {
  segmentPrices: ItemSegmentServicePriceRecord[];
}

export interface ListCatalogItemsWithMatrixResult {
  items: CatalogItemWithMatrix[];
  serviceCategories: ServiceCategoryRecord[];
  segmentCategories: SegmentCategoryRecord[];
}

export interface ListCatalogItemsWithMatrixDeps {
  laundryItemsRepo: LaundryItemsRepo;
  serviceCategoryRepo: ServiceCategoryRepo;
  segmentCategoryRepo: SegmentCategoryRepo;
  itemSegmentServicePriceRepo: ItemSegmentServicePriceRepo;
}

/** When set, only categories for this branch are returned (admin branch filter / OPS). Omit to union all branches (e.g. public price list). */
export interface ListCatalogItemsWithMatrixOptions {
  categoryBranchId?: string;
  /**
   * Org-wide “common” taxonomy branch (typically the default branch). When set and different from
   * `categoryBranchId`, service/segment lists merge both so branch staff see shared + branch-only rows.
   */
  sharedTaxonomyBranchId?: string;
}

function mergeCategoryRowsById<T extends { id: string; code: string; label: string }>(
  commonFirst: T[],
  branchSpecific: T[],
): T[] {
  const byId = new Map<string, T>();
  for (const row of commonFirst) byId.set(row.id, row);
  for (const row of branchSpecific) byId.set(row.id, row);
  return Array.from(byId.values()).sort((a, b) => {
    const la = `${a.label} ${a.code}`.toLowerCase();
    const lb = `${b.label} ${b.code}`.toLowerCase();
    return la.localeCompare(lb);
  });
}

export async function listCatalogItemsWithMatrix(
  deps: ListCatalogItemsWithMatrixDeps,
  options?: ListCatalogItemsWithMatrixOptions,
): Promise<ListCatalogItemsWithMatrixResult> {
  const branchId = options?.categoryBranchId?.trim();
  const sharedId = options?.sharedTaxonomyBranchId?.trim();
  const items = await deps.laundryItemsRepo.listAll();

  let serviceCategories: ServiceCategoryRecord[];
  let segmentCategories: SegmentCategoryRecord[];

  if (!branchId) {
    [serviceCategories, segmentCategories] = await Promise.all([
      deps.serviceCategoryRepo.listAll(),
      deps.segmentCategoryRepo.listAll(),
    ]);
  } else if (sharedId && sharedId !== branchId) {
    const [svcShared, segShared, svcBranch, segBranch] = await Promise.all([
      deps.serviceCategoryRepo.listByBranchId(sharedId),
      deps.segmentCategoryRepo.listByBranchId(sharedId),
      deps.serviceCategoryRepo.listByBranchId(branchId),
      deps.segmentCategoryRepo.listByBranchId(branchId),
    ]);
    serviceCategories = mergeCategoryRowsById(svcShared, svcBranch);
    segmentCategories = mergeCategoryRowsById(segShared, segBranch);
  } else {
    [serviceCategories, segmentCategories] = await Promise.all([
      deps.serviceCategoryRepo.listByBranchId(branchId),
      deps.segmentCategoryRepo.listByBranchId(branchId),
    ]);
  }
  const segmentPricesByItem = await Promise.all(
    items.map((item) => deps.itemSegmentServicePriceRepo.listByItemId(item.id)),
  );
  const itemsWithMatrix: CatalogItemWithMatrix[] = items.map((item, i) => ({
    ...item,
    segmentPrices: segmentPricesByItem[i] ?? [],
  }));
  return { items: itemsWithMatrix, serviceCategories, segmentCategories };
}
