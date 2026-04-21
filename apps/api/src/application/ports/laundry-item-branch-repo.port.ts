export interface LaundryItemBranchRepo {
  getBranchIdsForItem(itemId: string): Promise<string[]>;
  /** Item ids that have an explicit branch link (catalog rows assigned to at least one branch). */
  getItemIdsAssignedToBranch(branchId: string): Promise<string[]>;
  /** All item → branch ids from junction (items with no entry are treated as org-wide in customer catalog). */
  getItemIdToBranchIdsMap(): Promise<Map<string, string[]>>;
  setBranchesForItem(itemId: string, branchIds: string[]): Promise<void>;
}
