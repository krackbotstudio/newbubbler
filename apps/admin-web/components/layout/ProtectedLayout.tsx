'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getToken, getStoredUser, type AuthUser } from '@/lib/auth';
import { isOpsDeniedRoute, OPS_DEFAULT_REDIRECT } from '@/lib/permissions';
import { Sidebar } from './Sidebar';
import { Button } from '@/components/ui/button';
import { Menu } from 'lucide-react';

export function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const token = getToken();
    const stored = getStoredUser();
    if (!token || !stored) {
      router.replace('/login');
      return;
    }
    setUser(stored);
    setChecking(false);
  }, [router]);

  useEffect(() => {
    if (!user || user.role !== 'OPS') return;
    if (isOpsDeniedRoute(pathname ?? '')) {
      toast.error('No access');
      router.replace(OPS_DEFAULT_REDIRECT);
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

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1 min-h-0">
        <Sidebar
          user={user}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />
        <div className="flex flex-1 flex-col min-w-0">
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
            <span className="font-semibold text-sm truncate">Laundry Admin</span>
          </div>
          <main className="flex-1 overflow-auto p-4 sm:p-6 min-h-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
