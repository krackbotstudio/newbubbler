const TOKEN_KEY = 'admin_jwt';
const USER_KEY = 'admin_user';

export type Role = 'ADMIN' | 'OPS' | 'AGENT' | 'BILLING' | 'CUSTOMER';

export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
  role: Role;
  /** Set for Branch Head (OPS) and Agent (AGENT); walk-in and list APIs are scoped to this branch. */
  branchId?: string | null;
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

export function canAccessCatalogEdit(role: Role): boolean {
  return role === 'ADMIN';
}

export function canAccessPaymentEdit(role: Role): boolean {
  return role === 'ADMIN' || role === 'BILLING';
}

export function canAccessOrders(role: Role): boolean {
  return ['ADMIN', 'OPS', 'BILLING', 'AGENT'].includes(role);
}

export function canAccessBrandingEdit(role: Role): boolean {
  return role === 'ADMIN' || role === 'BILLING';
}

export function canAccessCustomersEdit(role: Role): boolean {
  return role === 'ADMIN';
}
