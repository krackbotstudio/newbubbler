export interface AdminUserRecord {
  id: string;
  name: string | null;
  email: string;
  role: string;
  branchId: string | null;
  branchIds: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminUsersFilters {
  role?: string;
  roles?: string[];
  actorRole?: string;
  active?: boolean;
  search?: string;
  /** When set, only users assigned to this branch (for branch head list). */
  branchId?: string;
  /** When set, filter users to any of these branches. */
  branchIds?: string[];
  /**
   * Branch head (OPS) list: agents in `branchId` plus always `includeUserId` (self).
   * When `agentsOnly`, only agents in the branch (role filter “Agent” in UI).
   * When `selfAsBranchHeadOnly`, only the signed-in branch head row (OPS in branch).
   */
  branchHeadList?: {
    branchId: string;
    includeUserId: string;
    includeUserEmail?: string | null;
    agentsOnly?: boolean;
    selfAsBranchHeadOnly?: boolean;
  };
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
    branchIds?: string[];
    isActive: boolean;
    passwordHash?: string | null;
  }): Promise<AdminUserRecord>;
  updateAdminUser(
    id: string,
    input: {
      name?: string | null;
      role?: string;
      branchId?: string | null;
      branchIds?: string[];
      isActive?: boolean;
    },
  ): Promise<AdminUserRecord>;

  getById(id: string): Promise<AdminUserRecord | null>;

  setPasswordHash(id: string, passwordHash: string): Promise<void>;

  deleteUser(id: string): Promise<void>;

  countByBranchAndRole(branchId: string, role: string): Promise<number>;
}

