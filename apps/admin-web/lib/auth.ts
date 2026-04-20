const TOKEN_KEY = 'admin_jwt';
const USER_KEY = 'admin_user';

export type Role = 'ADMIN' | 'PARTIAL_ADMIN' | 'OPS' | 'AGENT' | 'BILLING' | 'CUSTOMER';

export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
  role: Role;
  /** Set for Branch Head (OPS) and Agent (AGENT); walk-in and list APIs are scoped to this branch. */
  branchId?: string | null;
  /** Set for Partial Admin: allowed branch ids for data access. */
  branchIds?: string[];
  /** ISO timestamp; null/undefined means branch onboarding not finished (OPS only). */
  onboardingCompletedAt?: string | null;
}

type BranchLike = { id: string };

export function isPartialAdmin(role: Role | null | undefined): boolean {
  return role === 'PARTIAL_ADMIN';
}

/** For Partial Admin, keep only assigned branches; others see all branches. */
export function restrictBranchesForUser<T extends BranchLike>(
  branches: T[],
  user: AuthUser | null | undefined,
): T[] {
  if (!isPartialAdmin(user?.role)) return branches;
  const allowedIds = (user?.branchIds ?? []).map((id) => id.trim()).filter(Boolean);
  if (allowedIds.length === 0 && user?.branchId) {
    // Backward-compat: some sessions may still carry only branchId.
    allowedIds.push(user.branchId.trim());
  }
  // Safety fallback: when session branchIds are absent, trust API-side branch scoping.
  if (allowedIds.length === 0) return branches;
  const allowed = new Set(allowedIds);
  const filtered = branches.filter((branch) => allowed.has(branch.id));
  // If local storage has stale branch IDs, don't blank the UI; trust API-scoped list.
  return filtered.length > 0 ? filtered : branches;
}

/** Branch Head or Agent: assigned a single branch for data access. */
export function isBranchScopedStaff(role: Role): boolean {
  return role === 'OPS' || role === 'AGENT';
}

/** Branch filter is fixed to `branchId` (no “all branches” for OPS/AGENT with an assignment). */
export function isBranchFilterLocked(role: Role, branchId: string | null | undefined): boolean {
  return isBranchScopedStaff(role) && !!branchId;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AuthUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function logout(): void {
  clearAuth();
  window.location.href = '/login';
}

/** Laundry catalog mutations (items, matrix, segments). Branch heads need an assigned branch. */
export function canAccessCatalogEdit(role: Role, branchId?: string | null): boolean {
  if (role === 'ADMIN') return true;
  if (role === 'PARTIAL_ADMIN') return true;
  if (role === 'OPS' && branchId) return true;
  return false;
}

/** Card-level toggles and edit: branch heads only for items explicitly assigned to their branch. */
export function canBranchHeadEditCatalogItem(
  role: Role,
  branchId: string | null | undefined,
  itemBranchIds: string[] | undefined,
): boolean {
  if (role === 'ADMIN') return true;
  if (role === 'PARTIAL_ADMIN') return true;
  const ids = itemBranchIds ?? [];
  if (role !== 'OPS' || !branchId) return false;
  if (ids.length === 0) return false;
  return ids.includes(branchId);
}

/** Delete: admins (when they can edit); branch heads only if the item is exclusive to their branch. */
export function canDeleteCatalogItem(
  role: Role,
  branchId: string | null | undefined,
  itemBranchIds: string[] | undefined,
): boolean {
  if (!canBranchHeadEditCatalogItem(role, branchId, itemBranchIds)) return false;
  if (role === 'ADMIN') return true;
  const ids = itemBranchIds ?? [];
  return ids.length === 1 && ids[0] === branchId;
}

export function canAccessPaymentEdit(role: Role): boolean {
  return role === 'ADMIN' || role === 'PARTIAL_ADMIN' || role === 'BILLING';
}

export function canAccessOrders(role: Role): boolean {
  return ['ADMIN', 'PARTIAL_ADMIN', 'OPS', 'BILLING', 'AGENT'].includes(role);
}

export function canAccessBrandingEdit(role: Role): boolean {
  return role === 'ADMIN' || role === 'PARTIAL_ADMIN' || role === 'BILLING' || role === 'OPS';
}

export function canAccessCustomersEdit(role: Role): boolean {
  return role === 'ADMIN' || role === 'PARTIAL_ADMIN';
}
