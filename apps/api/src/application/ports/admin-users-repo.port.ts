export interface AdminUserRecord {
  id: string;
  name: string | null;
  email: string;
  role: string;
  branchId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminUsersFilters {
  role?: string;
  active?: boolean;
  search?: string;
  /** When set, only users assigned to this branch (for branch head list). */
  branchId?: string;
  limit: number;
  cursor?: string;
}

export interface AdminUsersResult {
  data: AdminUserRecord[];
  nextCursor: string | null;
}

export interface AdminUsersRepo {
  listAdmin(filters: AdminUsersFilters): Promise<AdminUsersResult>;
  createAdminUser(input: {
    name: string | null;
    email: string;
    role: string;
    branchId?: string | null;
    isActive: boolean;
    passwordHash?: string | null;
  }): Promise<AdminUserRecord>;
  updateAdminUser(
    id: string,
    input: {
      name?: string | null;
      role?: string;
      branchId?: string | null;
      isActive?: boolean;
    },
  ): Promise<AdminUserRecord>;

  getById(id: string): Promise<AdminUserRecord | null>;

  setPasswordHash(id: string, passwordHash: string): Promise<void>;

  deleteUser(id: string): Promise<void>;

  countByBranchAndRole(branchId: string, role: string): Promise<number>;
}

