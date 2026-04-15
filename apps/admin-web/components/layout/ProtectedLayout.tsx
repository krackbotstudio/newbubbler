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
import { api, getApiOrigin } from '@/lib/api';
import { cn } from '@/lib/utils';

export function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: branding } = useBranding();
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
          onboardingCompletedAt: string | null;
        }>('/auth/admin/profile');
        if (cancelled) return;
        const merged: AuthUser = {
          id: data.id,
          email: data.email ?? undefined,
          role: data.role,
          branchId: data.branchId,
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

  return (
    <div className="flex min-h-screen flex-col">
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
