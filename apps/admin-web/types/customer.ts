/** Saved address as returned with customer profile (GET /admin/customers/:id). */
export interface CustomerAddress {
  id: string;
  label: string;
  addressLine: string;
  pincode: string;
  isDefault: boolean;
  /** Optional Google Maps URL saved from the mobile app. */
  googleMapUrl?: string | null;
}

export interface CustomerRecord {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /** Saved addresses for this customer. */
  addresses?: CustomerAddress[];
}

/** Customer list row with order counts (GET /admin/customers). */
export interface CustomerListRow extends CustomerRecord {
  pastOrdersCount: number;
  activeOrdersCount: number;
}

export interface PatchCustomerBody {
  name?: string | null;
  email?: string | null;
  notes?: string | null;
}
