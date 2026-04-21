'use client';

import { useEffect } from 'react';
import { useBranch } from '@/hooks/useBranches';
import type { AuthUser } from '@/lib/auth';
import { branchHexToShellCssVars, clearAdminShellThemeVars, applyAdminShellThemeVars } from '@/lib/adminShellTheme';

/** Applies `globals.css` defaults for ADMIN; branch primary/secondary for branch-scoped staff. */
export function AdminShellTheme({ user }: { user: AuthUser }) {
  const branchId = user.role === 'ADMIN' ? null : (user.branchId ?? null);
  const { data: branch } = useBranch(branchId);

  useEffect(() => {
    const root = document.documentElement;
    if (user.role === 'ADMIN') {
      clearAdminShellThemeVars(root);
      return () => clearAdminShellThemeVars(root);
    }
    const vars = branchHexToShellCssVars(branch?.primaryColor, branch?.secondaryColor);
    if (vars) {
      applyAdminShellThemeVars(root, vars);
    } else {
      clearAdminShellThemeVars(root);
    }
    return () => clearAdminShellThemeVars(root);
  }, [user.role, branch?.primaryColor, branch?.secondaryColor, branchId]);

  return null;
}
