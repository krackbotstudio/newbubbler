'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { logout, type AuthUser } from '@/lib/auth';
import { canAccessRoute } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { getApiOrigin } from '@/lib/api';
import { useBranding } from '@/hooks/useBranding';
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
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type NavItem = { href: string; label: string; icon: LucideIcon };

/** Grouped nav order; items are filtered by role per group. */
const NAV_GROUPS: { items: NavItem[] }[] = [
  {
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/orders', label: 'Orders', icon: Package },
      { href: '/walk-in-orders', label: 'Walk-in orders', icon: Store },
      { href: '/customers', label: 'Customers', icon: Users },
    ],
  },
  {
    items: [
      { href: '/final-invoices', label: 'Final Invoices', icon: FileCheck },
      { href: '/subscriptions', label: 'Subscriptions', icon: FileText },
    ],
  },
  {
    items: [
      { href: '/catalog', label: 'Catalog', icon: FileText },
      { href: '/subscription-plans', label: 'Subscription plans', icon: FileText },
      { href: '/schedule', label: 'Schedule & calendar', icon: Calendar },
      { href: '/service-areas', label: 'Service areas', icon: MapPin },
      { href: '/branding', label: 'Branding', icon: Palette },
    ],
  },
  {
    items: [
      { href: '/admin-users', label: 'Admin users', icon: Shield },
      { href: '/analytics', label: 'Analytics', icon: BarChart3 },
      { href: '/feedback', label: 'Feedback', icon: MessageSquare },
    ],
  },
];

export interface SidebarProps {
  user: AuthUser;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ user, collapsed = false, onToggleCollapse, mobileOpen = false, onCloseMobile }: SidebarProps) {
  const pathname = usePathname();
  const { data: branding } = useBranding();

  const navGroups = useMemo(
    () =>
      NAV_GROUPS.map((g) => ({
        items: g.items.filter((item) => canAccessRoute(user.role, item.href)),
      })).filter((g) => g.items.length > 0),
    [user.role],
  );

  const logoUrl = branding?.logoUrl
    ? (() => {
        const base = branding.logoUrl.startsWith('http') ? branding.logoUrl : `${getApiOrigin()}${branding.logoUrl}`;
        return `${base}${base.includes('?') ? '&' : '?'}v=${encodeURIComponent(branding.updatedAt)}`;
      })()
    : null;

  const sidebarContent = (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-pink-200 px-3 dark:border-pink-800">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo"
            className={cn('h-8 w-auto object-contain object-left', collapsed ? 'max-w-[2rem]' : 'max-w-[140px]')}
          />
        ) : (
          <>
            {!collapsed && <span className="font-semibold truncate">Laundry Admin</span>}
            {collapsed && <span className="font-semibold truncate" title="Laundry Admin">LA</span>}
          </>
        )}
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
      <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
        {navGroups.map((group, groupIndex) => (
          <div
            key={groupIndex}
            className={cn(
              'space-y-0.5',
              groupIndex > 0 && 'mt-2 border-t border-pink-200 pt-2 dark:border-pink-800',
            )}
          >
            {group.items.map((item) => {
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
                    collapsed && 'justify-center px-2',
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
        <div className="mt-2 shrink-0 border-t border-pink-200 pt-2 dark:border-pink-800">
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
      </nav>
    </>
  );

  return (
    <>
      {mobileOpen && onCloseMobile && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 top-0 z-50 flex h-dvh flex-col border-r border-pink-200 bg-pink-50 transition-[width,transform] duration-200 ease-in-out dark:border-pink-800 dark:bg-pink-950/20',
          'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0',
          collapsed ? 'md:w-14' : 'md:w-56',
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
