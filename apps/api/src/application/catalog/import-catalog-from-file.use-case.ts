import type {
  LaundryItemsRepo,
  LaundryItemRecord,
  ServiceCategoryRepo,
  ServiceCategoryRecord,
  SegmentCategoryRepo,
  SegmentCategoryRecord,
  ItemSegmentServicePriceRepo,
} from '../ports';

export interface ImportRow {
  itemName: string;
  segmentCode: string;
  serviceCategoryCode: string;
  priceRupees: number;
  isActive?: boolean;
}

export interface ImportCatalogResult {
  createdItems: number;
  updatedItems: number;
  createdCategories: number;
  upsertedPrices: number;
  errors: Array<{ row: number; message: string }>;
}

export interface ImportCatalogFromFileDeps {
  laundryItemsRepo: LaundryItemsRepo;
  serviceCategoryRepo: ServiceCategoryRepo;
  segmentCategoryRepo: SegmentCategoryRepo;
  itemSegmentServicePriceRepo: ItemSegmentServicePriceRepo;
  /** Categories created or resolved during import are scoped to this branch. */
  taxonomyBranchId: string;
}

function parseCsvToRows(csv: string): string[][] {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  const rows: string[][] = [];
  for (const line of lines) {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if ((c === ',' && !inQuotes) || (c === '\t' && !inQuotes)) {
        cells.push(current.trim());
        current = '';
      } else {
        current += c;
      }
    }
    cells.push(current.trim());
    rows.push(cells);
  }
  return rows;
}

function parseRow(cells: string[]): { row: ImportRow; error?: string } {
  const itemName = (cells[0] ?? '').trim();
  const segmentCode = (cells[1] ?? '').trim().toUpperCase().replace(/\s+/g, '_');
  const serviceCategoryCode = (cells[2] ?? '').trim().toUpperCase().replace(/\s+/g, '_');
  const priceStr = (cells[3] ?? '').trim();
  const isActiveStr = (cells[4] ?? 'true').trim().toLowerCase();

  if (!itemName) return { row: {} as ImportRow, error: 'itemName is required' };
  if (!segmentCode) return { row: {} as ImportRow, error: 'segment code is required' };
  if (!serviceCategoryCode) return { row: {} as ImportRow, error: 'serviceCategoryCode is required' };
  const priceRupees = priceStr === '' ? 0 : parseInt(priceStr, 10);
  if (Number.isNaN(priceRupees) || priceRupees < 0) return { row: {} as ImportRow, error: 'priceRupees must be a non-negative integer' };
  const isActive = isActiveStr !== 'false' && isActiveStr !== '0';

  return {
    row: { itemName, segmentCode, serviceCategoryCode, priceRupees, isActive },
  };
}

export async function importCatalogFromFile(
  csvContent: string,
  deps: ImportCatalogFromFileDeps,
): Promise<ImportCatalogResult> {
  const rows = parseCsvToRows(csvContent);
  const header = rows[0];
  const dataRows = header && header[0]?.toLowerCase().includes('item') ? rows.slice(1) : rows;

  const result: ImportCatalogResult = {
    createdItems: 0,
    updatedItems: 0,
    createdCategories: 0,
    upsertedPrices: 0,
    errors: [],
  };

  const itemByName = new Map<string, LaundryItemRecord>();
  const categoryByCode = new Map<string, ServiceCategoryRecord>();
  const segmentByCode = new Map<string, SegmentCategoryRecord>();
  const updatedItemNames = new Set<string>();
  const taxonomyBranchId = deps.taxonomyBranchId;

  for (let i = 0; i < dataRows.length; i++) {
    const rowIndex = i + (rows.length - dataRows.length) + 1;
    const cells = dataRows[i];
    const parsed = parseRow(cells ?? []);
    if (parsed.error) {
      result.errors.push({ row: rowIndex, message: parsed.error });
      continue;
    }
    const { row } = parsed;

    let item = itemByName.get(row.itemName);
    if (!item) {
      const allItems = await deps.laundryItemsRepo.listAll();
      const existing = allItems.find((x) => x.name === row.itemName);
      if (existing) {
        item = existing;
        itemByName.set(row.itemName, item);
        if (!updatedItemNames.has(row.itemName)) {
          updatedItemNames.add(row.itemName);
          result.updatedItems++;
        }
      } else {
        item = await deps.laundryItemsRepo.create(row.itemName, true);
        itemByName.set(row.itemName, item);
        result.createdItems++;
      }
    }

    let segmentCat = segmentByCode.get(row.segmentCode);
    if (!segmentCat) {
      const existing = await deps.segmentCategoryRepo.getByBranchIdAndCode(taxonomyBranchId, row.segmentCode);
      if (existing) {
        segmentCat = existing;
      } else {
        segmentCat = await deps.segmentCategoryRepo.create(
          taxonomyBranchId,
          row.segmentCode,
          row.segmentCode.replace(/_/g, ' '),
          true,
        );
      }
      segmentByCode.set(row.segmentCode, segmentCat);
    }

    let category = categoryByCode.get(row.serviceCategoryCode);
    if (!category) {
      let existing = await deps.serviceCategoryRepo.getByBranchIdAndCode(taxonomyBranchId, row.serviceCategoryCode);
      if (existing) {
        category = existing;
      } else {
        category = await deps.serviceCategoryRepo.create(
          taxonomyBranchId,
          row.serviceCategoryCode,
          row.serviceCategoryCode.replace(/_/g, ' '),
          true,
        );
        result.createdCategories++;
      }
      categoryByCode.set(row.serviceCategoryCode, category);
    }

    try {
      await deps.itemSegmentServicePriceRepo.upsert(
        item.id,
        segmentCat.id,
        category.id,
        row.priceRupees,
        row.isActive ?? true,
      );
      result.upsertedPrices++;
    } catch (e) {
      result.errors.push({
        row: rowIndex,
        message: e instanceof Error ? e.message : 'Failed to upsert price',
      });
    }
  }

  return result;
}
