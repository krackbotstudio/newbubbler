import type { Role } from '@shared/enums';
import type { AdminUsersRepo, AdminUserRecord } from '../ports';

export interface CreateAdminUserInput {
  name: string | null;
  email: string;
  role: Role;
  branchId?: string | null;
  branchIds?: string[];
  isActive: boolean;
  passwordHash?: string | null;
}

export interface CreateAdminUserDeps {
  adminUsersRepo: AdminUsersRepo;
}

export async function createAdminUser(
  input: CreateAdminUserInput,
  deps: CreateAdminUserDeps,
): Promise<AdminUserRecord> {
  return deps.adminUsersRepo.createAdminUser(input);
}

