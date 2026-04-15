export interface LaundryItemRecord {
  id: string;
  name: string;
  active: boolean;
  /** Optional icon name for this catalog item (stored as plain string) */
  icon?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LaundryItemsRepo {
  create(name: string, active: boolean, icon?: string | null): Promise<LaundryItemRecord>;
  update(
    id: string,
    patch: { name?: string; active?: boolean; icon?: string | null },
  ): Promise<LaundryItemRecord>;
  listAll(): Promise<LaundryItemRecord[]>;
  listActive(): Promise<LaundryItemRecord[]>;
  getById(id: string): Promise<LaundryItemRecord | null>;
  /** Removes item and cascaded prices/matrix/branch links. Fails if referenced by order line items. */
  delete(id: string): Promise<void>;
}
