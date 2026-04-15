import type { ServiceType } from './order';

export interface SegmentCategory {
  id: string;
  branchId: string;
  code: string;
  label: string;
  isActive: boolean;
  createdAt: string;
}

export interface LaundryItem {
  id: string;
  name: string;
  active: boolean;
  /** Optional icon name associated with this catalog item. */
  icon?: string | null;
  createdAt: string;
  updatedAt: string;
  /** When returned from API with prices (e.g. single item or list) */
  prices?: LaundryItemPrice[];
}

export interface LaundryItemPrice {
  id: string;
  itemId: string;
  serviceType: ServiceType;
  unitPricePaise: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceCategory {
  id: string;
  branchId: string;
  code: string;
  label: string;
  isActive: boolean;
  createdAt: string;
}

export interface ItemSegmentServicePrice {
  id: string;
  itemId: string;
  segmentCategoryId: string;
  serviceCategoryId: string;
  priceRupees: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogItemWithMatrix {
  id: string;
  name: string;
  active: boolean;
  icon?: string | null;
  branchIds: string[];
  createdAt: string;
  updatedAt: string;
  segmentPrices: ItemSegmentServicePrice[];
}

export interface CatalogMatrixResponse {
  items: CatalogItemWithMatrix[];
  serviceCategories: ServiceCategory[];
  segmentCategories: SegmentCategory[];
}

export interface SegmentPriceInput {
  segmentCategoryId: string;
  serviceCategoryId: string;
  priceRupees: number;
  isActive: boolean;
}

export interface UpdateItemWithMatrixBody {
  name?: string;
  active?: boolean;
  icon?: string | null;
  branchIds?: string[];
  segmentPrices: SegmentPriceInput[];
}

export interface CreateItemBody {
  name: string;
  active?: boolean;
  icon?: string | null;
}

export interface PatchItemBody {
  name?: string;
  active?: boolean;
  icon?: string | null;
}

export interface PriceItemBody {
  serviceType: ServiceType;
  unitPricePaise: number;
  active?: boolean;
}

export interface PutItemPricesBody {
  prices: PriceItemBody[];
}

export interface ImportCatalogResult {
  createdItems: number;
  updatedItems: number;
  createdCategories: number;
  upsertedPrices: number;
  errors: Array<{ row: number; message: string }>;
}
