'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getToken, getStoredUser, setStoredUser, type AuthUser } from '@/lib/auth';
import {
  isOpsDeniedRoute,
  OPS_DEFAULT_REDIRECT,
  AGENT_DEFAULT_REDIRECT,
  canAccessRoute,
} from '@/lib/permissions';
import { Sidebar } from './Sidebar';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';
import { useBranding } from '@/hooks/useBranding';
import { useBranch } from '@/hooks/useBranches';
import { api, getApiOrigin } from '@/lib/api';
import { cn } from '@/lib/utils';

function hexToHslParts(hex: string): string | null {
  const clean = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return `0 0% ${Math.round(l * 100)}%`;
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  switch (max) {
    case r:
      h = (g - b) / d + (g < b ? 6 : 0);
      break;
    case g:
      h = (b - r) / d + 2;
      break;
    default:
      h = (r - g) / d + 4;
      break;
  }
  h /= 6;
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: branding } = useBranding();
  const { data: activeBranch } = useBranch(user?.branchId ?? null);
  const logoUrl = branding?.logoUrl
    ? (() => {
        const base = branding.logoUrl.startsWith('http') ? branding.logoUrl : `${getApiOrigin()}${branding.logoUrl}`;
        return `${base}${base.includes('?') ? '&' : '?'}v=${encodeURIComponent(branding.updatedAt)}`;
      })()
    : null;

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (!token || !stored) {
      router.replace('/login');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get<{
          id: string;
          email: string | null;
          role: AuthUser['role'];
          branchId: string | null;
          branchIds?: string[];
          onboardingCompletedAt: string | null;
        }>('/auth/admin/profile');
        if (cancelled) return;
        const merged: AuthUser = {
          id: data.id,
          email: data.email ?? undefined,
          role: data.role,
          branchId: data.branchId,
          branchIds: data.branchIds ?? stored.branchIds ?? [],
          onboardingCompletedAt: data.onboardingCompletedAt,
        };
        setStoredUser(merged);
        setUser(merged);
      } catch {
        if (!cancelled) {
          setUser(stored);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'OPS') {
      const onboardingIncomplete =
        user.onboardingCompletedAt == null || user.onboardingCompletedAt === '';
      if (onboardingIncomplete && pathname !== '/onboarding') {
        router.replace('/onboarding');
        return;
      }
      if (!onboardingIncomplete && pathname === '/onboarding') {
        router.replace('/dashboard');
        return;
      }
      if (isOpsDeniedRoute(pathname ?? '')) {
        toast.error('No access');
        router.replace(OPS_DEFAULT_REDIRECT);
      }
      return;
    }
    if (user.role === 'AGENT' && !canAccessRoute('AGENT', pathname ?? '')) {
      toast.error('No access');
      router.replace(AGENT_DEFAULT_REDIRECT);
    }
  }, [user, pathname, router]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Apply theme variables on :root so portal content (dialogs/toasts) also picks branch colors.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const prevPrimary = root.style.getPropertyValue('--primary');
    const prevRing = root.style.getPropertyValue('--ring');
    const prevSecondary = root.style.getPropertyValue('--secondary');
    const prevAccent = root.style.getPropertyValue('--accent');

    const primary = activeBranch?.primaryColor ? hexToHslParts(activeBranch.primaryColor) : null;
    const secondary = activeBranch?.secondaryColor ? hexToHslParts(activeBranch.secondaryColor) : null;
    if (primary) {
      root.style.setProperty('--primary', primary);
      root.style.setProperty('--ring', primary);
    }
    if (secondary) {
      root.style.setProperty('--secondary', secondary);
      root.style.setProperty('--accent', secondary);
    }

    return () => {
      root.style.setProperty('--primary', prevPrimary);
      root.style.setProperty('--ring', prevRing);
      root.style.setProperty('--secondary', prevSecondary);
      root.style.setProperty('--accent', prevAccent);
    };
  }, [activeBranch?.primaryColor, activeBranch?.secondaryColor]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const opsOnboardingIncomplete =
    user.role === 'OPS' &&
    (user.onboardingCompletedAt == null || user.onboardingCompletedAt === '');
  const showSidebar = !opsOnboardingIncomplete;
  const branchThemeStyle = (() => {
    const primary = activeBranch?.primaryColor ? hexToHslParts(activeBranch.primaryColor) : null;
    const secondary = activeBranch?.secondaryColor ? hexToHslParts(activeBranch.secondaryColor) : null;
    if (!primary && !secondary) return undefined;
    return {
      ...(primary ? { ['--primary' as const]: primary, ['--ring' as const]: primary } : {}),
      ...(secondary
        ? {
            ['--secondary' as const]: secondary,
            ['--accent' as const]: secondary,
          }
        : {}),
    } as Record<string, string>;
  })();

  return (
    <div className="flex min-h-screen flex-col" style={branchThemeStyle}>
      <div className="flex flex-1 min-h-0">
        {showSidebar ? (
          <Sidebar
            user={user}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
            mobileOpen={mobileMenuOpen}
            onCloseMobile={() => setMobileMenuOpen(false)}
          />
        ) : null}
        <div
          className={cn(
            'flex flex-1 flex-col min-w-0 transition-[padding] duration-200 ease-in-out',
            showSidebar && (sidebarCollapsed ? 'md:pl-14' : 'md:pl-56'),
          )}
        >
          {showSidebar ? (
            <div className="sticky top-0 z-30 flex md:hidden items-center gap-2 border-b bg-background px-4 py-2">
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="h-7 w-auto max-w-[120px] object-contain object-left" />
              ) : (
                <span className="font-semibold text-sm truncate">Laundry Admin</span>
              )}
            </div>
          ) : null}
          <main className="flex-1 overflow-auto p-4 sm:p-6 min-h-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
