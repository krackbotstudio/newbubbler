import { Role } from '@shared/enums';
import type { AuthUser } from './roles.guard';
import { AGENT_ROLE } from './agent-role';

/** Branch Head or Agent: JWT carries branchId; list/detail queries must be scoped to that branch. */
export function isBranchScopedStaffRole(role: Role): boolean {
  return role === Role.OPS || role === AGENT_ROLE;
}

export function effectiveBranchIdForAdminQuery(
  user: AuthUser | undefined,
  queryBranchId?: string | null,
): string | undefined {
  if (!user) return queryBranchId?.trim() || undefined;
  if (isBranchScopedStaffRole(user.role) && user.branchId) {
    return user.branchId;
  }
  return queryBranchId?.trim() || undefined;
}
