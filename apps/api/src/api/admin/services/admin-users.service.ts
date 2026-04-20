import { Inject, Injectable } from '@nestjs/common';
import { Role } from '@shared/enums';
import {
  createAdminUser,
  type CreateAdminUserInput,
} from '../../../application/admin-users/create-admin-user.use-case';
import {
  listAdminUsers,
  type ListAdminUsersDeps,
} from '../../../application/admin-users/list-admin-users.use-case';
import {
  updateAdminUser,
  type UpdateAdminUserInput,
} from '../../../application/admin-users/update-admin-user.use-case';
import type { AdminUsersRepo, AdminUsersFilters } from '../../../application/ports';
import { ADMIN_USERS_REPO } from '../../../infra/infra.module';
import { AppError } from '../../../application/errors';
import type { AuthUser } from '../../common/roles.guard';
import { generateTempPassword, hashAdminPassword } from '../../auth/password.util';

/** This user cannot be deleted by anyone. */
export const PROTECTED_ADMIN_EMAIL = 'weyou@admin.com';

/** String literals so create/update accept AGENT even if `Role` enum at runtime is stale. */
const CREATABLE_STAFF_ROLES: readonly string[] = ['ADMIN', 'PARTIAL_ADMIN', 'OPS', 'AGENT'];
const ROLES_REQUIRING_BRANCH: readonly string[] = ['OPS', 'AGENT'];
const PARTIAL_ADMIN_ROLE = 'PARTIAL_ADMIN';

function isProtectedAdminEmail(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase() === PROTECTED_ADMIN_EMAIL;
}

function normalizeBranchIds(branchIds: string[] | undefined): string[] {
  if (!branchIds) return [];
  return Array.from(new Set(branchIds.map((id) => id.trim()).filter(Boolean)));
}

function canPartialAdminManageRole(role: string): boolean {
  return role === 'OPS' || role === 'AGENT';
}

@Injectable()
export class AdminUsersService {
  constructor(
    @Inject(ADMIN_USERS_REPO)
    private readonly adminUsersRepo: AdminUsersRepo,
  ) {}

  private get deps(): ListAdminUsersDeps {
    return { adminUsersRepo: this.adminUsersRepo };
  }

  async list(filters: AdminUsersFilters) {
    if (filters.actorRole === Role.PARTIAL_ADMIN) {
      // Partial admins can only manage/view branch heads and agents in their assigned branches.
      if (filters.role && !canPartialAdminManageRole(filters.role)) {
        return { data: [], nextCursor: null };
      }
      if (!filters.role) filters.roles = ['OPS', 'AGENT'];
      const allowed = normalizeBranchIds(filters.branchIds);
      if (allowed.length === 0) return { data: [], nextCursor: null };
      filters.branchIds = allowed;
      if (filters.branchId && !allowed.includes(filters.branchId)) {
        return { data: [], nextCursor: null };
      }
      if (filters.branchId) {
        filters.branchIds = undefined;
      }
    }
    return listAdminUsers(filters, this.deps);
  }

  async create(input: CreateAdminUserInput, actor?: AuthUser) {
    if (actor?.role === Role.OPS) {
      if (input.role === Role.ADMIN || input.role === Role.BILLING) {
        throw new AppError('FORBIDDEN', 'Branch heads cannot create platform admin users');
      }
      if (input.role !== Role.OPS && input.role !== Role.AGENT) {
        throw new AppError('FEEDBACK_INVALID', 'Branch heads can only create Branch Head or Agent accounts');
      }
      const bid = actor.branchId;
      if (!bid || input.branchId !== bid) {
        throw new AppError('BRANCH_REQUIRED', 'New staff must belong to your branch');
      }
      if (input.role === Role.OPS) {
        const n = await this.adminUsersRepo.countByBranchAndRole(bid, 'OPS');
        if (n >= 2) {
          throw new AppError('QUOTA', 'This branch already has the maximum of 2 branch head accounts');
        }
      }
      if (input.role === Role.AGENT) {
        const n = await this.adminUsersRepo.countByBranchAndRole(bid, 'AGENT');
        if (n >= 2) {
          throw new AppError('QUOTA', 'This branch already has the maximum of 2 agent accounts');
        }
      }
    }

    if (!CREATABLE_STAFF_ROLES.includes(input.role)) {
      throw new AppError(
        'FEEDBACK_INVALID',
        'Only Admin, Partial Admin, Branch Head, and Agent roles are allowed',
      );
    }
    if (actor?.role === Role.PARTIAL_ADMIN) {
      if (!canPartialAdminManageRole(input.role)) {
        throw new AppError('FORBIDDEN', 'Partial admin can create only Branch Head or Agent accounts');
      }
      const allowed = normalizeBranchIds(actor.branchIds);
      if (!input.branchId || !allowed.includes(input.branchId)) {
        throw new AppError('BRANCH_REQUIRED', 'New staff must belong to one of your assigned branches');
      }
      input.branchIds = [];
    }
    input.branchIds = normalizeBranchIds(input.branchIds);
    if (input.role === PARTIAL_ADMIN_ROLE && (input.branchIds ?? []).length === 0) {
      throw new AppError('BRANCH_REQUIRED', 'At least one branch is required for Partial Admin');
    }
    if (input.role !== PARTIAL_ADMIN_ROLE && (input.branchIds?.length ?? 0) > 0) {
      input.branchIds = [];
    }
    if (ROLES_REQUIRING_BRANCH.includes(input.role) && !input.branchId) {
      throw new AppError('BRANCH_REQUIRED', 'Branch is required for Branch Head and Agent roles');
    }
    if (!ROLES_REQUIRING_BRANCH.includes(input.role)) {
      input.branchId = null;
    }
    const tempPassword = generateTempPassword(12);
    const user = await createAdminUser(
      {
        ...input,
        passwordHash: hashAdminPassword(tempPassword),
      },
      this.deps,
    );
    return { user, tempPassword };
  }

  async update(input: UpdateAdminUserInput, currentUser: AuthUser) {
    const targetUser = await this.adminUsersRepo.getById(input.id);
    if (!targetUser) {
      throw new AppError('NOT_FOUND', 'User not found', { userId: input.id });
    }
    if (isProtectedAdminEmail(targetUser.email)) {
      throw new AppError('CANNOT_UPDATE_PROTECTED', 'This user cannot be edited', {
        email: PROTECTED_ADMIN_EMAIL,
      });
    }
    if (currentUser.role === Role.PARTIAL_ADMIN) {
      if (!canPartialAdminManageRole(targetUser.role)) {
        throw new AppError('FORBIDDEN', 'Partial admin can manage only Branch Head or Agent users');
      }
      const allowed = normalizeBranchIds(currentUser.branchIds);
      if (!targetUser.branchId || !allowed.includes(targetUser.branchId)) {
        throw new AppError('FORBIDDEN', 'You can only manage users in your assigned branches');
      }
      if (input.role && !canPartialAdminManageRole(input.role)) {
        throw new AppError('FORBIDDEN', 'Partial admin can assign only Branch Head or Agent roles');
      }
      if (input.branchId && !allowed.includes(input.branchId)) {
        throw new AppError('BRANCH_REQUIRED', 'User branch must be one of your assigned branches');
      }
      if (input.branchIds !== undefined) {
        throw new AppError('FORBIDDEN', 'Partial admin cannot assign partial-admin branch access');
      }
    }

    if (input.role && !CREATABLE_STAFF_ROLES.includes(input.role)) {
      throw new AppError(
        'FEEDBACK_INVALID',
        'Only Admin, Partial Admin, Branch Head, and Agent roles are allowed',
      );
    }
    if (input.branchIds !== undefined) {
      input.branchIds = normalizeBranchIds(input.branchIds);
    }
    const effectiveRole = input.role ?? targetUser.role;
    const needsBranch = ROLES_REQUIRING_BRANCH.includes(effectiveRole);
    if (needsBranch && input.branchId === undefined) {
      const existing = await this.adminUsersRepo.getById(input.id);
      if (!existing?.branchId) {
        throw new AppError('BRANCH_REQUIRED', 'Branch is required for Branch Head and Agent roles');
      }
    }
    if (needsBranch && input.branchId === '') {
      throw new AppError('BRANCH_REQUIRED', 'Branch is required for Branch Head and Agent roles');
    }
    if (effectiveRole === PARTIAL_ADMIN_ROLE) {
      const effectiveBranchIds = input.branchIds ?? normalizeBranchIds(targetUser.branchIds ?? []);
      if (!effectiveBranchIds.length) {
        throw new AppError('BRANCH_REQUIRED', 'At least one branch is required for Partial Admin');
      }
      input.branchIds = effectiveBranchIds;
      if (input.branchId !== undefined) {
        input.branchId = null;
      }
    } else if (input.branchIds !== undefined) {
      input.branchIds = [];
    }
    if (input.isActive === false && input.id === currentUser.id) {
      throw new AppError('CANNOT_DISABLE_SELF', 'You cannot disable your own admin account', {
        userId: currentUser.id,
      });
    }
    return updateAdminUser(input, this.deps);
  }

  async resetPassword(userId: string, actor?: AuthUser): Promise<{ tempPassword: string }> {
    const user = await this.adminUsersRepo.getById(userId);
    if (!user) {
      throw new AppError('NOT_FOUND', 'User not found', { userId });
    }
    if (isProtectedAdminEmail(user.email)) {
      throw new AppError('CANNOT_RESET_PROTECTED', 'Password cannot be reset for this user', {
        email: PROTECTED_ADMIN_EMAIL,
      });
    }
    if (actor?.role === Role.PARTIAL_ADMIN) {
      if (!canPartialAdminManageRole(user.role)) {
        throw new AppError('FORBIDDEN', 'Partial admin can reset password only for Branch Head or Agent users');
      }
      const allowed = normalizeBranchIds(actor.branchIds);
      if (!user.branchId || !allowed.includes(user.branchId)) {
        throw new AppError('FORBIDDEN', 'You can only manage users in your assigned branches');
      }
    }
    const tempPassword = generateTempPassword(12);
    await this.adminUsersRepo.setPasswordHash(userId, hashAdminPassword(tempPassword));
    return { tempPassword };
  }

  async delete(userId: string, actor?: AuthUser): Promise<void> {
    const user = await this.adminUsersRepo.getById(userId);
    if (!user) {
      throw new AppError('NOT_FOUND', 'User not found', { userId });
    }
    if (isProtectedAdminEmail(user.email)) {
      throw new AppError('CANNOT_DELETE_PROTECTED', 'This user cannot be deleted', {
        email: PROTECTED_ADMIN_EMAIL,
      });
    }
    if (actor?.role === Role.PARTIAL_ADMIN) {
      if (!canPartialAdminManageRole(user.role)) {
        throw new AppError('FORBIDDEN', 'Partial admin can delete only Branch Head or Agent users');
      }
      const allowed = normalizeBranchIds(actor.branchIds);
      if (!user.branchId || !allowed.includes(user.branchId)) {
        throw new AppError('FORBIDDEN', 'You can only manage users in your assigned branches');
      }
    }
    await this.adminUsersRepo.deleteUser(userId);
  }
}

