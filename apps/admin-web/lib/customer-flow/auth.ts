const TOKEN_KEY = 'customer_flow_jwt';
const USER_KEY = 'customer_flow_user';

export interface CustomerUser {
  id: string;
  phone: string | null;
  role: string;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

export function getStoredUser(): CustomerUser | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CustomerUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: CustomerUser): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function logoutToBranch(branchSlug?: string): void {
  clearAuth();
  if (typeof window === 'undefined') return;
  const slug = (branchSlug ?? '').trim();
  if (slug) {
    window.location.href = `/customer/${slug}/login`;
    return;
  }
  window.location.href = '/';
}
