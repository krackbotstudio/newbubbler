export interface SegmentCategoryRecord {
  id: string;
  branchId: string;
  code: string;
  label: string;
  isActive: boolean;
  createdAt: Date;
}

export interface SegmentCategoryRepo {
  create(branchId: string, code: string, label: string, isActive?: boolean): Promise<SegmentCategoryRecord>;
  getById(id: string): Promise<SegmentCategoryRecord | null>;
  getByBranchIdAndCode(branchId: string, code: string): Promise<SegmentCategoryRecord | null>;
  /** First match when scoping to branches (e.g. legacy MEN sync). Empty branchIds = any branch. */
  findFirstByCodeInBranches(code: string, branchIds: string[]): Promise<SegmentCategoryRecord | null>;
  update(id: string, patch: { label?: string; isActive?: boolean }): Promise<SegmentCategoryRecord>;
  delete(id: string): Promise<void>;
  listAll(): Promise<SegmentCategoryRecord[]>;
  listByBranchId(branchId: string): Promise<SegmentCategoryRecord[]>;
  listActive(): Promise<SegmentCategoryRecord[]>;
}
