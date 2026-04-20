export interface CustomerRecord {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  notes: string | null;
  expoPushToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateCustomerPatch {
  name?: string | null;
  email?: string | null;
  notes?: string | null;
  expoPushToken?: string | null;
}

export interface ListCustomersResult {
  data: CustomerRecord[];
  nextCursor: string | null;
}

export interface CreateCustomerInput {
  phone: string;
  name?: string | null;
  email?: string | null;
}

export interface CustomersRepo {
  /** Substring match on phone (admin search / branch head). Does not filter by branch or orders — same discovery scope as walk-in. */
  findByPhone(phoneLike: string, branchId?: string | null): Promise<CustomerRecord[]>;
  /** Exact match by phone (for walk-in lookup). Returns null if not found or not CUSTOMER. */
  getByPhone(phone: string): Promise<CustomerRecord | null>;
  getById(userId: string): Promise<CustomerRecord | null>;
  /** Create a customer (User with role CUSTOMER). Phone must be unique. */
  create(input: CreateCustomerInput): Promise<CustomerRecord>;
  update(userId: string, patch: UpdateCustomerPatch): Promise<CustomerRecord>;
  /** Total number of users with role CUSTOMER. */
  count(): Promise<number>;
  /**
   * Distinct customers who have at least one non-cancelled order attributed to this branch
   * (same branch attribution rules as admin order list).
   */
  countWithOrdersInBranch(branchId: string): Promise<number>;
  /** List customers with optional cursor and search (phone/name). When branchId is set, only customers with an order in that branch (same attribution as admin orders). */
  list(limit: number, cursor?: string | null, search?: string | null, branchId?: string | null): Promise<ListCustomersResult>;
}
