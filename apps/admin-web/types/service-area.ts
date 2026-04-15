export interface ServiceArea {
  id: string;
  pincode: string;
  branchId: string;
  active: boolean;
}

export interface CreateServiceAreaBody {
  pincode: string;
  branchId: string;
  active: boolean;
}

export interface PatchServiceAreaBody {
  branchId?: string;
  active?: boolean;
}
