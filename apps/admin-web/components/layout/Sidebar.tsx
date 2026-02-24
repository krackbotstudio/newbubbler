'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { logout, type AuthUser } from '@/lib/auth';
import { canAccessRoute } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { API_BASE_URL } from '@/lib/api';
import { useSystemStatus } from '@/hooks/use-system-status';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  Package,
  FileText,
  FileCheck,
  MapPin,
  Palette,
  Users,
  BarChart3,
  MessageSquare,
  LogOut,
  Shield,
  Calendar,
  Store,
  PanelLeftClose,
  PanelLeft,
  X,
  RefreshCw,
} from 'lucide-react';

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/orders', label: 'Orders', icon: Package },
  { href: '/walk-in-orders', label: 'Walk-in orders', icon: Store },
  { href: '/final-invoices', label: 'Final Invoices', icon: FileCheck },
  { href: '/subscriptions', label: 'Subscriptions', icon: FileText },
  { href: '/catalog', label: 'Catalog', icon: FileText },
  { href: '/subscription-plans', label: 'Subscription plans', icon: FileText },
  { href: '/schedule', label: 'Schedule & calendar', icon: Calendar },
  { href: '/service-areas', label: 'Service areas', icon: MapPin },
  { href: '/branding', label: 'Branding', icon: Palette },
  { href: '/admin-users', label: 'Admin users', icon: Shield },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/feedback', label: 'Feedback', icon: MessageSquare },
];

function StatusDot({ status }: { status: 'green' | 'yellow' | 'red' }) {
  return (
    <span
      className={cn(
        'inline-block h-1.5 w-1.5 rounded-full shrink-0',
        status === 'green' && 'bg-green-500',
        status === 'yellow' && 'bg-amber-500',
        status === 'red' && 'bg-red-500'
      )}
      title={status}
    />
  );
}

export interface SidebarProps {
  user: AuthUser;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ user, collapsed = false, onToggleCollapse, mobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { api, auth, db, dbInfo, lastError, checking, refresh } = useSystemStatus();
  const navItems = NAV.filter((item) => canAccessRoute(user.role, item.href));

  const handleInvalidate = () => {
    queryClient.invalidateQueries();
    toast.success('Cache invalidated');
  };

  const sidebarContent = (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-3">
        {!collapsed && <span className="font-semibold truncate">Laundry Admin</span>}
        {collapsed && <span className="font-semibold truncate" title="Laundry Admin">LA</span>}
        <div className="flex items-center gap-1">
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 md:flex hidden"
              onClick={onToggleCollapse}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          )}
          {onCloseMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 md:hidden"
              onClick={onCloseMobile}
              title="Close menu"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              title={collapsed ? item.label : undefined}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                collapsed && 'justify-center px-2'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-2 shrink-0 space-y-2">
        {!collapsed && (
          <>
            <div className="px-3 text-[11px] text-muted-foreground space-y-0.5">
              <div className="truncate" title={API_BASE_URL}>
                API: {API_BASE_URL.replace(/^https?:\/\//, '').replace(/\/api\/?$/, '').slice(0, 28)}
                {(API_BASE_URL.length > 35) ? '…' : ''}
              </div>
              {dbInfo && (
                <div className="truncate" title={dbInfo.db_host}>
                  DB: {dbInfo.db_host_display} · {dbInfo.database_name}
                </div>
              )}
              <div className="truncate">
                User: {user?.email ?? user?.phone ?? user?.id ?? '—'} · {user?.role ?? '—'}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <StatusDot status={api} />
                <StatusDot status={auth} />
                <StatusDot status={db} />
                {checking && <span className="text-muted-foreground">…</span>}
                {lastError && (
                  <span className="truncate max-w-[120px] text-amber-600 dark:text-amber-400" title={String(lastError)}>!</span>
                )}
                <Button variant="ghost" size="icon" className="h-5 w-5 p-0 shrink-0" onClick={refresh} disabled={checking} title="Refresh status">
                  <RefreshCw className={cn('h-3 w-3', checking && 'animate-spin')} />
                </Button>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 h-8 text-xs"
              onClick={handleInvalidate}
            >
              <RefreshCw className="h-3 w-3 shrink-0" />
              Invalidate cache
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={cn('w-full justify-start gap-2', collapsed && 'justify-center px-2')}
          onClick={() => {
            logout();
            toast.info('Logged out');
          }}
          title={collapsed ? 'Log out' : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Log out</span>}
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && onCloseMobile && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onCloseMobile}
        />
      )}
      {/* Sidebar: drawer on mobile (w-64), collapsible on desktop (w-56 or w-14) */}
      <aside
        className={cn(
          'flex flex-col border-r bg-pink-50 dark:bg-pink-950/20 z-50 transition-[width] duration-200 ease-in-out',
          'fixed md:relative inset-y-0 left-0 top-0',
          'w-64',
          'md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'md:!translate-x-0',
          collapsed ? 'md:w-14' : 'md:w-56'
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
