export interface ServiceAreaRecord {
  id: string;
  pincode: string;
  branchId: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateServiceAreaPatch {
  branchId?: string;
  active?: boolean;
}

export interface ServiceAreaRepo {
  isServiceable(pincode: string): Promise<boolean>;
  listAll(): Promise<ServiceAreaRecord[]>;
  listByBranchId(branchId: string): Promise<ServiceAreaRecord[]>;
  /** All active service areas for this pincode (multiple branches may serve the same pincode). */
  listActiveByPincode(pincode: string): Promise<ServiceAreaRecord[]>;
  /** When multiple branches serve the same pincode, prefers the default branch’s row, then any active row. */
  getByPincode(pincode: string): Promise<ServiceAreaRecord | null>;
  getById(id: string): Promise<ServiceAreaRecord | null>;
  /** Creates or updates the service area for this branch and pincode (same pincode may exist on other branches). */
  upsert(pincode: string, branchId: string, active: boolean): Promise<ServiceAreaRecord>;
  setActive(id: string, active: boolean): Promise<ServiceAreaRecord>;
  update(id: string, patch: UpdateServiceAreaPatch): Promise<ServiceAreaRecord>;
  remove(id: string): Promise<void>;
}

