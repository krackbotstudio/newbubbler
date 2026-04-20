import type { Role } from '@shared/enums';
import type { AdminUsersRepo, AdminUserRecord } from '../ports';

export interface UpdateAdminUserInput {
  id: string;
  name?: string | null;
  role?: Role;
  branchId?: string | null;
  branchIds?: string[];
  isActive?: boolean;
}

export interface UpdateAdminUserDeps {
  adminUsersRepo: AdminUsersRepo;
}

export async function updateAdminUser(
  input: UpdateAdminUserInput,
  deps: UpdateAdminUserDeps,
): Promise<AdminUserRecord> {
  const { id, ...data } = input;
  return deps.adminUsersRepo.updateAdminUser(id, data);
}

