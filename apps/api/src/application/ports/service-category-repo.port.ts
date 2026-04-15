export interface ServiceCategoryRecord {
  id: string;
  branchId: string;
  code: string;
  label: string;
  isActive: boolean;
  createdAt: Date;
}

export interface ServiceCategoryRepo {
  create(branchId: string, code: string, label: string, isActive?: boolean): Promise<ServiceCategoryRecord>;
  getById(id: string): Promise<ServiceCategoryRecord | null>;
  getByBranchIdAndCode(branchId: string, code: string): Promise<ServiceCategoryRecord | null>;
  update(id: string, patch: { label?: string; isActive?: boolean }): Promise<ServiceCategoryRecord>;
  delete(id: string): Promise<void>;
  listAll(): Promise<ServiceCategoryRecord[]>;
  listByBranchId(branchId: string): Promise<ServiceCategoryRecord[]>;
  listActive(): Promise<ServiceCategoryRecord[]>;
}
