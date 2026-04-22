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
import type {
  AdminUsersRepo,
  AdminUsersFilters,
  AdminUserRecord,
} from '../../../application/ports';
import { ADMIN_USERS_REPO } from '../../../infra/infra.module';
import { AppError } from '../../../application/errors';
import type { AuthUser } from '../../common/roles.guard';
import { generateTempPassword, hashAdminPassword } from '../../auth/password.util';

/** This user cannot be deleted by anyone. */
export const PROTECTED_ADMIN_EMAIL = 'weyou@admin.com';

/** String literals so create/update accept AGENT even if `Role` enum at runtime is stale. */
const CREATABLE_STAFF_ROLES: readonly string[] = ['ADMIN', 'OPS', 'AGENT'];
const ROLES_REQUIRING_BRANCH: readonly string[] = ['OPS', 'AGENT'];

function isProtectedAdminEmail(email: string | null | undefined): boolean {
  return (email ?? '').trim().toLowerCase() === PROTECTED_ADMIN_EMAIL;
}

function requireOpsBranchId(actor: AuthUser): string {
  const bid = actor.branchId ?? '';
  if (!bid) {
    throw new AppError('FORBIDDEN', 'Branch head is not assigned to a branch.');
  }
  return bid;
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
    const result = await listAdminUsers(filters, this.deps);
    const bh = filters.branchHeadList;
    /**
     * Branch head “All roles”: if the signed-in user row is missing from the page (query edge cases,
     * id/email drift, etc.), merge it in so they always see themselves alongside branch staff.
     */
    if (
      bh &&
      !bh.agentsOnly &&
      !bh.selfAsBranchHeadOnly &&
      filters.actorRole === Role.OPS
    ) {
      const hasSelf = result.data.some((u) => u.id === bh.includeUserId);
      if (!hasSelf) {
        const self = await this.adminUsersRepo.getById(bh.includeUserId);
        if (self) {
          const limit = filters.limit ?? 20;
          const merged = [self, ...result.data].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
          result.data = merged.slice(0, limit);
        }
      }
    }
    return result;
  }

  async create(input: CreateAdminUserInput, actor?: AuthUser) {
    if (actor?.role === Role.OPS) {
      throw new AppError('FORBIDDEN', 'Branch heads cannot create admin users');
    }

    if (!CREATABLE_STAFF_ROLES.includes(input.role)) {
      throw new AppError(
        'FEEDBACK_INVALID',
        'Only Admin, Branch Head, and Agent roles are allowed',
      );
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
    if (input.role && !CREATABLE_STAFF_ROLES.includes(input.role)) {
      throw new AppError(
        'FEEDBACK_INVALID',
        'Only Admin, Branch Head, and Agent roles are allowed',
      );
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
    if (input.isActive === false && input.id === currentUser.id) {
      throw new AppError('CANNOT_DISABLE_SELF', 'You cannot disable your own admin account', {
        userId: currentUser.id,
      });
    }
    if (currentUser.role === Role.OPS) {
      this.assertOpsCanUpdate(currentUser, targetUser, input);
    }
    return updateAdminUser(input, this.deps);
  }

  async resetPassword(userId: string, actor: AuthUser): Promise<{ tempPassword: string }> {
    const user = await this.adminUsersRepo.getById(userId);
    if (!user) {
      throw new AppError('NOT_FOUND', 'User not found', { userId });
    }
    if (isProtectedAdminEmail(user.email)) {
      throw new AppError('CANNOT_RESET_PROTECTED', 'Password cannot be reset for this user', {
        email: PROTECTED_ADMIN_EMAIL,
      });
    }
    if (actor.role === Role.OPS) {
      this.assertOpsCanResetPassword(actor, user);
    }
    const tempPassword = generateTempPassword(12);
    await this.adminUsersRepo.setPasswordHash(userId, hashAdminPassword(tempPassword));
    return { tempPassword };
  }

  async delete(userId: string, actor: AuthUser): Promise<void> {
    const user = await this.adminUsersRepo.getById(userId);
    if (!user) {
      throw new AppError('NOT_FOUND', 'User not found', { userId });
    }
    if (isProtectedAdminEmail(user.email)) {
      throw new AppError('CANNOT_DELETE_PROTECTED', 'This user cannot be deleted', {
        email: PROTECTED_ADMIN_EMAIL,
      });
    }
    if (actor.role === Role.OPS) {
      this.assertOpsCannotDelete();
    }
    await this.adminUsersRepo.deleteUser(userId);
  }

  private assertOpsCannotDelete(): void {
    throw new AppError('FORBIDDEN', 'Branch heads cannot delete admin users.');
  }

  private assertOpsCanUpdate(
    actor: AuthUser,
    target: AdminUserRecord,
    input: UpdateAdminUserInput,
  ): void {
    const bid = requireOpsBranchId(actor);
    if (target.branchId !== bid) {
      throw new AppError('FORBIDDEN', 'You cannot edit users outside your branch.');
    }
    if (target.id === actor.id) {
      throw new AppError(
        'FORBIDDEN',
        'Branch heads cannot edit their own account here. Use Reset password if needed.',
      );
    }
    if (target.role === Role.AGENT) {
      if (input.role != null && input.role !== Role.AGENT) {
        throw new AppError('FORBIDDEN', 'You cannot change this user’s role.');
      }
      if (input.branchId !== undefined && input.branchId !== bid) {
        throw new AppError('FORBIDDEN', 'Agents must stay in your branch.');
      }
      return;
    }
    throw new AppError('FORBIDDEN', 'You can only edit agent accounts in your branch.');
  }

  private assertOpsCanResetPassword(actor: AuthUser, target: AdminUserRecord): void {
    const bid = requireOpsBranchId(actor);
    if (target.branchId !== bid) {
      throw new AppError('FORBIDDEN', 'You cannot reset passwords for users outside your branch.');
    }
    if (target.role === Role.AGENT) {
      return;
    }
    if (target.role === Role.OPS && target.id === actor.id) {
      return;
    }
    throw new AppError(
      'FORBIDDEN',
      'You can only reset passwords for agents in your branch or your own account.',
    );
  }

}

