import { Role } from '@shared/enums';
import type { AuthUser } from './roles.guard';
import { AGENT_ROLE } from './agent-role';

/** Branch Head or Agent: JWT carries branchId; list/detail queries must be scoped to that branch. */
export function isBranchScopedStaffRole(role: Role): boolean {
  return role === Role.OPS || role === AGENT_ROLE;
}

export function resolveScopedBranchId(
  user: AuthUser | undefined,
  queryBranchId?: string | null,
): string | undefined {
  const cleanedQuery = queryBranchId?.trim() || undefined;
  if (!user) return cleanedQuery;
  if (isBranchScopedStaffRole(user.role) && user.branchId) return user.branchId;
  if (user.role === Role.PARTIAL_ADMIN) {
    const allowed = user.branchIds ?? [];
    if (cleanedQuery && allowed.includes(cleanedQuery)) return cleanedQuery;
    return allowed[0];
  }
  return cleanedQuery;
}

export function effectiveBranchIdForAdminQuery(
  user: AuthUser | undefined,
  queryBranchId?: string | null,
): string | undefined {
  return resolveScopedBranchId(user, queryBranchId);
}
