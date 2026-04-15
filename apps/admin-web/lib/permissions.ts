import type { Role } from '@/lib/auth';

/**
 * Central permission map for admin-web.
 * - ADMIN / BILLING: full access (allow all routes).
 * - OPS: restricted; denyRoutes are hidden from nav and redirect if accessed directly.
 * - AGENT: only listed routes (branch-scoped in API).
 */
export const ROLE_PERMISSIONS: Record<
  Role,
  { allow?: readonly string[]; denyRoutes?: readonly string[]; navHide?: readonly string[] }
> = {
  ADMIN: { allow: ['*'] },
  BILLING: { allow: ['*'] },
  OPS: { denyRoutes: ['/analytics', '/admin-users'] },
  AGENT: {
    allow: ['/dashboard', '/orders', '/feedback'],
    navHide: ['/orders', '/customers'],
  },
  CUSTOMER: { denyRoutes: ['*'] },
};

const OPS_DENIED_ROUTES = ROLE_PERMISSIONS.OPS.denyRoutes as string[];

/**
 * Returns true if the user role can access the given pathname.
 * Used for sidebar visibility and route guarding.
 */
export function canAccessRoute(role: Role, pathname: string): boolean {
  const perm = ROLE_PERMISSIONS[role];
  if (!perm) return false;
  if (perm.allow?.includes('*')) return true;
  if (perm.allow && perm.allow.length > 0) {
    return perm.allow.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  }
  const deny = perm.denyRoutes ?? [];
  if (deny.includes('*')) return false;
  const denied = deny.some(
    (r) => pathname === r || pathname.startsWith(r + '/')
  );
  return !denied;
}

/**
 * Returns true if the nav item should be hidden from the sidebar for this role.
 * The route may still be accessible (e.g. order detail via redirect) but won't show in nav.
 */
export function isNavHidden(role: Role, pathname: string): boolean {
  const perm = ROLE_PERMISSIONS[role];
  const hidden = perm?.navHide ?? [];
  return hidden.some((r) => pathname === r);
}

/**
 * Default redirect for OPS when they hit a denied route.
 */
export const OPS_DEFAULT_REDIRECT = '/orders';

/** Default redirect for Agent when they hit a disallowed route. */
export const AGENT_DEFAULT_REDIRECT = '/dashboard';

/**
 * Routes OPS must not access (for guard redirect).
 */
export function isOpsDeniedRoute(pathname: string): boolean {
  return OPS_DENIED_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + '/')
  );
}
